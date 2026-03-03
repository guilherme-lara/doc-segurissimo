-- Allow unauthenticated clients to update text_answer and is_completed on request_items
-- This is needed because clients fill in text answers without authentication
CREATE POLICY "request_items_public_update_text"
ON public.request_items
FOR UPDATE
USING (true)
WITH CHECK (true);