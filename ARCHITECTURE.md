# Portal Seguríssimo — Arquitetura do Back-end (v3)

> **IMPORTANTE**: Este documento é a referência para recriar o back-end
> no servidor físico em `jotatechinfo.com.br`. Contém o código exato de
> tabelas, políticas RLS, buckets de storage e funções.

---

## 1. Estrutura de Rotas (Front-end)

```
/                                → Landing page (conversão B2B)
/auth/login                      → Login / Signup
/admin/dashboard                 → Painel Admin (role: admin)
/:slug/enviar/:requestId         → Upload com checklist (link único)
/:slug/dashboard                 → Dashboard autenticado do profissional
```

---

## 2. Enum e Tabelas

### 2.0 Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.user_plan AS ENUM ('free', 'pro');
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
  cnpj TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_slug ON public.companies(slug);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_public_read" ON public.companies FOR SELECT USING (true);
CREATE POLICY "companies_admin_read" ON public.companies FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "companies_owner_insert" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companies_owner_update" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "companies_owner_delete" ON public.companies FOR DELETE USING (auth.uid() = user_id);
```

### 2.4 `user_plans` — Planos Freemium

```sql
CREATE TABLE public.user_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan user_plan NOT NULL DEFAULT 'free',
  max_file_size_mb INT NOT NULL DEFAULT 50,
  max_active_requests INT NOT NULL DEFAULT 5,
  show_watermark BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- Leitura pública (watermark check)
CREATE POLICY "user_plans_public_read_watermark" ON public.user_plans FOR SELECT USING (true);
-- Owner + admin read
CREATE POLICY "user_plans_owner_read" ON public.user_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
-- Apenas admin altera planos
CREATE POLICY "user_plans_admin_update" ON public.user_plans FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
-- Insert público (via trigger SECURITY DEFINER)
CREATE POLICY "user_plans_admin_insert" ON public.user_plans FOR INSERT WITH CHECK (true);

-- PRO values: plan='pro', max_file_size_mb=1024, max_active_requests=999, show_watermark=false
-- FREE values: plan='free', max_file_size_mb=50, max_active_requests=5, show_watermark=true
```

### 2.5 `document_requests` — Solicitações de Documentos

```sql
CREATE TABLE public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  access_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_requests_public_read" ON public.document_requests FOR SELECT USING (true);
CREATE POLICY "doc_requests_admin_read" ON public.document_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "doc_requests_owner_insert" ON public.document_requests
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
CREATE POLICY "doc_requests_owner_update" ON public.document_requests
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
CREATE POLICY "doc_requests_owner_delete" ON public.document_requests
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
```

### 2.6 `request_items` — Itens do Checklist

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

### 2.7 `uploads` — Arquivos Enviados

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- INTENCIONAL: Upload público (core feature - clientes enviam sem login)
CREATE POLICY "uploads_public_insert" ON public.uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "uploads_admin_read" ON public.uploads FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "uploads_owner_read" ON public.uploads
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
CREATE POLICY "uploads_owner_delete" ON public.uploads
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));
```

---

## 3. Storage

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);

CREATE POLICY "uploads_storage_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "uploads_storage_owner_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (SELECT c.user_id FROM public.companies c JOIN public.uploads u ON u.company_id = c.id WHERE u.file_path = name)
  );

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
CREATE TRIGGER update_user_plans_updated_at BEFORE UPDATE ON public.user_plans
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

-- Auto-criar plano free ao criar company
CREATE OR REPLACE FUNCTION public.handle_new_company_plan()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_plans (company_id, plan) VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_company_created_add_plan AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_company_plan();

-- Auto-marcar item como completo quando upload é inserido
CREATE OR REPLACE FUNCTION public.mark_item_completed_on_upload()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.request_items SET is_completed = true WHERE id = NEW.request_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_upload_inserted AFTER INSERT ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.mark_item_completed_on_upload();

-- Desmarcar item quando upload é rejeitado (cliente pode reenviar)
CREATE OR REPLACE FUNCTION public.unmark_item_on_rejection()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN
    UPDATE public.request_items SET is_completed = false WHERE id = NEW.request_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_upload_rejected AFTER UPDATE ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.unmark_item_on_rejection();
```

---

## 5. Admin Seed

```
Email: admin@techbauru.com.br
Senha: Admin@@160124
Role: admin (via user_roles)
```

Edge function `seed-admin` cria o usuário e atribui a role automaticamente.

---

## 6. Modelo Freemium

| Feature | Free | Pro |
|---|---|---|
| Solicitações ativas | 5 | Ilimitado |
| Upload máximo | 50MB | 2GB |
| Marca d'água | ✅ Sim | ❌ Removida |
| Lembrete Mágico (WhatsApp) | ❌ | ✅ |
| Senha no link | ❌ | ✅ |
| White-label (logo, cor, CNPJ) | ❌ | ✅ |
| Motivo de rejeição visível | ✅ | ✅ |

---

## 7. Notas para Migração (jotatechinfo.com.br)

- PostgreSQL + PostgREST substitui o Supabase
- Storage → MinIO ou sistema de arquivos local
- Auth → GoTrue self-hosted ou JWT customizado
- RLS funciona nativamente no PostgreSQL
- As policies de INSERT público são intencionais (upload sem auth)
- O trigger mark_item_completed_on_upload é SECURITY DEFINER (bypass RLS)
- Replicar handle_new_company_plan para auto-criar plano free
