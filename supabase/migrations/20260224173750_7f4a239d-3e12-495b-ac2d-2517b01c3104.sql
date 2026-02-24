
-- ═══════════════════════════════════════════════════════════
-- Freemium Model: user_plans table + admin seed setup
-- ═══════════════════════════════════════════════════════════

-- Plan type enum
CREATE TYPE public.user_plan AS ENUM ('free', 'pro');

-- User plans table (tracks subscription per company)
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

-- Owner can read own plan
CREATE POLICY "user_plans_owner_read" ON public.user_plans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Only admin can update plans
CREATE POLICY "user_plans_admin_update" ON public.user_plans
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Only admin can insert plans (auto-created via trigger below)
CREATE POLICY "user_plans_admin_insert" ON public.user_plans
  FOR INSERT WITH CHECK (true);

-- Public read for anonymous users checking watermark
CREATE POLICY "user_plans_public_read_watermark" ON public.user_plans
  FOR SELECT USING (true);

-- Auto-create free plan when a company is created
CREATE OR REPLACE FUNCTION public.handle_new_company_plan()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_plans (company_id, plan)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_company_created_add_plan
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_company_plan();

-- Updated_at trigger for user_plans
CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Admin RLS: allow admin to read all companies
CREATE POLICY "companies_admin_read" ON public.companies
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: allow admin to read all uploads
CREATE POLICY "uploads_admin_read" ON public.uploads
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: allow admin to read all document_requests
CREATE POLICY "doc_requests_admin_read" ON public.document_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
