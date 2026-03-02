
-- Add link expiration support (PRO feature)
ALTER TABLE public.document_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Add text-type items support in checklists
ALTER TABLE public.request_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'file';
ALTER TABLE public.request_items ADD COLUMN IF NOT EXISTS text_answer TEXT DEFAULT NULL;

-- Add OwnCloud configuration columns to companies (PRO)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owncloud_url TEXT DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owncloud_user TEXT DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owncloud_token TEXT DEFAULT NULL;
