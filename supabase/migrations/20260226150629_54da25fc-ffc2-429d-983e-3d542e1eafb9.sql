
-- Add rejection_reason to uploads table
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add access_password to document_requests table (PRO feature)
ALTER TABLE public.document_requests ADD COLUMN IF NOT EXISTS access_password TEXT;

-- Add branding fields to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;

-- When professional rejects a file, unmark the item as completed so client can re-upload
CREATE OR REPLACE FUNCTION public.unmark_item_on_rejection()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN
    UPDATE public.request_items SET is_completed = false WHERE id = NEW.request_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_upload_rejected
  AFTER UPDATE ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.unmark_item_on_rejection();
