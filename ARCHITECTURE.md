# Portal Seguríssimo — Arquitetura do Back-end (v2)

> **IMPORTANTE**: Este documento é a referência para recriar o back-end
> no servidor físico em `jotatechinfo.com.br`. Contém o código exato de
> tabelas, políticas RLS, buckets de storage e funções.

---

## 1. Estrutura de Rotas (Front-end)

```
/                                → Landing page (vendas)
/auth/login                      → Login / Signup
/:slug/enviar/:requestId         → Upload com checklist (link único por solicitação)
/:slug/dashboard                 → Dashboard autenticado do profissional
```

---

## 2. Enum e Tabelas

### 2.0 Enum de Roles

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```

### 2.1 `user_roles` — Papéis de Usuário

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
```

### 2.2 Função de Verificação de Role

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### 2.3 `companies` — Empresas/Profissionais

```sql
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_slug ON public.companies(slug);
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_public_read" ON public.companies FOR SELECT USING (true);
CREATE POLICY "companies_owner_insert" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companies_owner_update" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "companies_owner_delete" ON public.companies FOR DELETE USING (auth.uid() = user_id);
```

### 2.4 `document_requests` — Solicitações de Documentos

```sql
CREATE TABLE public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_requests_company ON public.document_requests(company_id);
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_requests_public_read" ON public.document_requests FOR SELECT USING (true);
CREATE POLICY "doc_requests_owner_insert" ON public.document_requests
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
CREATE POLICY "doc_requests_owner_update" ON public.document_requests
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
CREATE POLICY "doc_requests_owner_delete" ON public.document_requests
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
```

### 2.5 `request_items` — Itens do Checklist

```sql
CREATE TABLE public.request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.document_requests(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL DEFAULT 'Geral',
  item_name TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_items_request ON public.request_items(request_id);
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_items_public_read" ON public.request_items FOR SELECT USING (true);
CREATE POLICY "request_items_owner_insert" ON public.request_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.document_requests dr JOIN public.companies c ON c.id = dr.company_id WHERE dr.id = request_id AND c.user_id = auth.uid())
  );
CREATE POLICY "request_items_owner_update" ON public.request_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.document_requests dr JOIN public.companies c ON c.id = dr.company_id WHERE dr.id = request_id AND c.user_id = auth.uid())
  );
```

### 2.6 `uploads` — Arquivos Enviados

```sql
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  sender_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uploads_item ON public.uploads(request_item_id);
CREATE INDEX idx_uploads_company ON public.uploads(company_id);
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- INTENCIONAL: Upload público (core feature - clientes enviam sem login)
CREATE POLICY "uploads_public_insert" ON public.uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "uploads_owner_read" ON public.uploads
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
CREATE POLICY "uploads_owner_delete" ON public.uploads
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
```

---

## 3. Storage

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);

-- Upload público
CREATE POLICY "uploads_storage_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads');

-- Download restrito ao dono
CREATE POLICY "uploads_storage_owner_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (SELECT c.user_id FROM public.companies c JOIN public.uploads u ON u.company_id = c.id WHERE u.file_path = name)
  );

-- Delete restrito ao dono
CREATE POLICY "uploads_storage_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (SELECT c.user_id FROM public.companies c JOIN public.uploads u ON u.company_id = c.id WHERE u.file_path = name)
  );
```

---

## 4. Triggers

```sql
-- Updated_at automático
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doc_requests_updated_at BEFORE UPDATE ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-criar company e role ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.companies (user_id, slug, display_name)
  VALUES (NEW.id, LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')), SPLIT_PART(NEW.email, '@', 1));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 5. Autenticação

- Login/Signup via e-mail e senha (Supabase Auth / GoTrue)
- JWT automático pelo cliente Supabase
- Proteção de rotas no React (verificação de sessão)

---

## 6. Notas para Migração (jotatechinfo.com.br)

- PostgreSQL + PostgREST substitui o Supabase
- Storage → MinIO ou sistema de arquivos local
- Auth → GoTrue self-hosted ou JWT customizado
- RLS funciona nativamente no PostgreSQL
- As policies de INSERT público são intencionais (upload sem auth)
