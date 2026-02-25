
-- ═══════════════════════════════════════════════════════════════
-- Portal Seguríssimo — Migration: File Preview, Audit Logs, Branding
-- ═══════════════════════════════════════════════════════════════

-- 1. Add status column to uploads (pending → approved/rejected)
--    Used by professional to approve/reject uploaded files
ALTER TABLE public.uploads ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- 2. Add primary_color to companies for PRO branding feature
--    PRO users can customize the color their clients see
ALTER TABLE public.companies ADD COLUMN primary_color text DEFAULT '#7c3aed';

-- 3. Create audit_logs table for compliance (PRO feature)
--    Timeline: link generated, client viewed, file uploaded, file rejected
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.document_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Owner + admin can read audit logs
CREATE POLICY "audit_logs_owner_read" ON public.audit_logs FOR SELECT
USING (
  EXISTS (SELECT 1 FROM companies WHERE companies.id = audit_logs.company_id AND companies.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS: Public insert (triggers and anonymous clients create logs)
CREATE POLICY "audit_logs_public_insert" ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- 4. Auto-create audit log when upload is inserted
CREATE OR REPLACE FUNCTION public.log_upload_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (company_id, request_id, action, details)
  SELECT
    NEW.company_id,
    ri.request_id,
    'file_uploaded',
    'Arquivo "' || NEW.file_name || '" enviado (' || pg_size_pretty(NEW.file_size) || ')'
  FROM public.request_items ri WHERE ri.id = NEW.request_item_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_upload_audit_log
  AFTER INSERT ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_upload_event();

-- 5. Auto-create audit log when upload status changes (approve/reject)
CREATE OR REPLACE FUNCTION public.log_upload_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (company_id, request_id, action, details)
    SELECT
      NEW.company_id,
      ri.request_id,
      CASE NEW.status WHEN 'approved' THEN 'file_approved' WHEN 'rejected' THEN 'file_rejected' ELSE 'file_status_changed' END,
      'Arquivo "' || NEW.file_name || '" ' || CASE NEW.status WHEN 'approved' THEN 'aprovado ✅' WHEN 'rejected' THEN 'rejeitado ❌' ELSE 'alterado' END
    FROM public.request_items ri WHERE ri.id = NEW.request_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_upload_status_change_audit
  AFTER UPDATE ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_upload_status_change();

-- 6. Allow owner to UPDATE uploads (for approve/reject)
CREATE POLICY "uploads_owner_update" ON public.uploads FOR UPDATE
USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = uploads.company_id AND companies.user_id = auth.uid()));

-- 7. Auto-log when a document_request is created (link generated)
CREATE OR REPLACE FUNCTION public.log_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (company_id, request_id, action, details)
  VALUES (NEW.company_id, NEW.id, 'link_generated', 'Link de solicitação criado para "' || NEW.client_name || '"');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_request_created_audit
  AFTER INSERT ON public.document_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_request_created();
