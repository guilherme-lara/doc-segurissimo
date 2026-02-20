
-- Trigger: auto-mark request_item as completed when an upload is inserted
-- This replaces the client-side UPDATE which fails due to RLS (client is anonymous)
CREATE OR REPLACE FUNCTION public.mark_item_completed_on_upload()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.request_items
  SET is_completed = true
  WHERE id = NEW.request_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_upload_inserted
  AFTER INSERT ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_item_completed_on_upload();
