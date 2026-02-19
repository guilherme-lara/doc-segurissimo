
-- =====================================================
-- PORTAL SEGURÍSSIMO — Schema Completo
-- Documentação: ARCHITECTURE.md
-- =====================================================

-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função de verificação de role (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policy: usuários podem ler seus próprios roles
CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Tabela de empresas/profissionais
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

-- Leitura pública (para buscar via slug na tela de upload)
CREATE POLICY "companies_public_read" ON public.companies
  FOR SELECT USING (true);

CREATE POLICY "companies_owner_insert" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "companies_owner_update" ON public.companies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "companies_owner_delete" ON public.companies
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Tabela de solicitações de documentos (o "checklist")
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

-- Leitura pública (clientes acessam via link)
CREATE POLICY "doc_requests_public_read" ON public.document_requests
  FOR SELECT USING (true);

-- Dono da empresa gerencia
CREATE POLICY "doc_requests_owner_insert" ON public.document_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

CREATE POLICY "doc_requests_owner_update" ON public.document_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

CREATE POLICY "doc_requests_owner_delete" ON public.document_requests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- 6. Itens do checklist (cada documento solicitado)
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

-- Leitura pública (clientes veem o checklist)
CREATE POLICY "request_items_public_read" ON public.request_items
  FOR SELECT USING (true);

-- Dono da empresa gerencia
CREATE POLICY "request_items_owner_insert" ON public.request_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_requests dr
      JOIN public.companies c ON c.id = dr.company_id
      WHERE dr.id = request_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "request_items_owner_update" ON public.request_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.document_requests dr
      JOIN public.companies c ON c.id = dr.company_id
      WHERE dr.id = request_id AND c.user_id = auth.uid()
    )
  );

-- Cliente pode marcar como concluído (update público para is_completed)
CREATE POLICY "request_items_public_update_completed" ON public.request_items
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- 7. Uploads vinculados a itens do checklist
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

-- Upload público (clientes enviam sem login)
CREATE POLICY "uploads_public_insert" ON public.uploads
  FOR INSERT WITH CHECK (true);

-- Dono da empresa visualiza
CREATE POLICY "uploads_owner_read" ON public.uploads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- Dono da empresa deleta
CREATE POLICY "uploads_owner_delete" ON public.uploads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- 8. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doc_requests_updated_at
  BEFORE UPDATE ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Storage bucket para uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);

-- Upload público
CREATE POLICY "uploads_storage_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads');

-- Download apenas para dono da empresa
CREATE POLICY "uploads_storage_owner_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (
      SELECT c.user_id FROM public.companies c
      JOIN public.uploads u ON u.company_id = c.id
      WHERE u.file_path = name
    )
  );

-- Delete apenas para dono
CREATE POLICY "uploads_storage_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (
      SELECT c.user_id FROM public.companies c
      JOIN public.uploads u ON u.company_id = c.id
      WHERE u.file_path = name
    )
  );

-- 10. Trigger para criar company automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.companies (user_id, slug, display_name)
  VALUES (
    NEW.id,
    LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')),
    SPLIT_PART(NEW.email, '@', 1)
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
