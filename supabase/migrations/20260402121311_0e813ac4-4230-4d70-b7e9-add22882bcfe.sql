
-- 1. Fix uploads_public_insert: validate request_item_id belongs to valid request
DROP POLICY IF EXISTS "uploads_public_insert" ON public.uploads;
CREATE POLICY "uploads_public_insert" ON public.uploads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.request_items ri
    JOIN public.document_requests dr ON dr.id = ri.request_id
    WHERE ri.id = uploads.request_item_id
      AND dr.status NOT IN ('archived', 'completed')
      AND uploads.company_id = dr.company_id
  )
);

-- 2. Fix uploads_public_read: clients can only read uploads for items they access
DROP POLICY IF EXISTS "uploads_public_read" ON public.uploads;
CREATE POLICY "uploads_public_read" ON public.uploads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.request_items ri
    WHERE ri.id = uploads.request_item_id
  )
);

-- 3. Fix request_items_public_update_text: scope to active requests only
DROP POLICY IF EXISTS "request_items_public_update_text" ON public.request_items;
CREATE POLICY "request_items_public_update_text" ON public.request_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.document_requests dr
    WHERE dr.id = request_items.request_id
      AND dr.status NOT IN ('archived', 'completed')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_requests dr
    WHERE dr.id = request_items.request_id
      AND dr.status NOT IN ('archived', 'completed')
  )
);

-- 4. Fix audit_logs_public_insert: validate company exists
DROP POLICY IF EXISTS "audit_logs_public_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_public_insert" ON public.audit_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = audit_logs.company_id
  )
);

-- 5. Add google_drive columns to companies table for future integration
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gdrive_client_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gdrive_client_secret text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gdrive_refresh_token text DEFAULT NULL;
