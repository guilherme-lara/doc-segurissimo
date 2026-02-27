-- Allow public (unauthenticated) users to read uploads
-- so the client portal can check upload statuses (approved/rejected/pending)
CREATE POLICY "uploads_public_read"
ON public.uploads
FOR SELECT
USING (true);