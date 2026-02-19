# Portal Seguríssimo — Arquitetura do Back-end

> **IMPORTANTE**: Este documento é a referência para recriar o back-end 
> no servidor físico em `jotatechinfo.com.br`. Contém o código exato de 
> tabelas, políticas RLS, buckets de storage e funções.

---

## 1. Estrutura de Rotas (Front-end)

```
/                         → Landing page
/:slug/enviar             → Upload público (white-label)
/:slug/login              → Login do profissional
/:slug/dashboard          → Dashboard autenticado
```

---

## 2. Tabelas do Banco de Dados

### 2.1 `companies` — Empresas/Profissionais

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

-- Índice para busca por slug (usado na área pública)
CREATE INDEX idx_companies_slug ON public.companies(slug);

-- Índice para busca por user_id (usado no dashboard)
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
```

### 2.2 `uploads` — Arquivos recebidos

```sql
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,          -- caminho no storage bucket
  sender_name TEXT,                 -- nome opcional de quem enviou
  sender_email TEXT,                -- email opcional de quem enviou
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para listar uploads por empresa
CREATE INDEX idx_uploads_company_id ON public.uploads(company_id);
```

---

## 3. Políticas RLS (Row Level Security)

### 3.1 Tabela `companies`

```sql
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode ler (necessário para área pública buscar dados via slug)
CREATE POLICY "companies_public_read" ON public.companies
  FOR SELECT USING (true);

-- Apenas o dono pode atualizar sua empresa
CREATE POLICY "companies_owner_update" ON public.companies
  FOR UPDATE USING (auth.uid() = user_id);

-- Apenas o dono pode inserir (vinculado ao seu user_id)
CREATE POLICY "companies_owner_insert" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Apenas o dono pode deletar
CREATE POLICY "companies_owner_delete" ON public.companies
  FOR DELETE USING (auth.uid() = user_id);
```

### 3.2 Tabela `uploads`

```sql
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode inserir (upload público sem login)
CREATE POLICY "uploads_public_insert" ON public.uploads
  FOR INSERT WITH CHECK (true);

-- Apenas o dono da empresa pode visualizar os uploads
CREATE POLICY "uploads_owner_read" ON public.uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = uploads.company_id
      AND companies.user_id = auth.uid()
    )
  );

-- Apenas o dono da empresa pode deletar uploads
CREATE POLICY "uploads_owner_delete" ON public.uploads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = uploads.company_id
      AND companies.user_id = auth.uid()
    )
  );
```

---

## 4. Storage Buckets

```sql
-- Bucket para armazenar os arquivos enviados
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false);
```

### Políticas de Storage

```sql
-- Upload público (qualquer pessoa pode fazer upload)
CREATE POLICY "uploads_public_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads'
  );

-- Apenas o dono da empresa pode baixar
CREATE POLICY "uploads_owner_download" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (
      SELECT c.user_id FROM public.companies c
      JOIN public.uploads u ON u.company_id = c.id
      WHERE u.file_path = name
    )
  );

-- Apenas o dono pode deletar
CREATE POLICY "uploads_owner_delete_storage" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads'
    AND auth.uid() IN (
      SELECT c.user_id FROM public.companies c
      JOIN public.uploads u ON u.company_id = c.id
      WHERE u.file_path = name
    )
  );
```

---

## 5. Funções de Upload (Edge Function)

```typescript
// supabase/functions/upload-file/index.ts
// Esta função será criada quando conectarmos o Lovable Cloud.
// Responsável por:
// 1. Receber o arquivo via multipart/form-data
// 2. Validar o slug da empresa
// 3. Fazer upload para o bucket 'uploads'
// 4. Registrar metadata na tabela 'uploads'
// 5. Retornar confirmação de sucesso
```

---

## 6. Autenticação

Utiliza **Supabase Auth** com e-mail e senha.

- Registro: Profissional cria conta e define slug/display_name
- Login: `/:slug/login` autentica via `supabase.auth.signInWithPassword()`
- Sessão: JWT armazenado automaticamente pelo cliente Supabase
- Proteção de rotas: Dashboard verifica `supabase.auth.getSession()`

---

## 7. Variáveis de Ambiente

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

---

## 8. Notas para Migração

- O Supabase pode ser substituído por PostgreSQL + PostgREST no servidor físico
- As políticas RLS funcionam nativamente no PostgreSQL
- O storage pode ser substituído por MinIO ou sistema de arquivos local
- A autenticação pode ser migrada para GoTrue (usado pelo Supabase) ou outra solução JWT
