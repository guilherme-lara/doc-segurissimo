-- Create document_templates table
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document_template_items table
CREATE TABLE public.document_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  stage_name TEXT NOT NULL DEFAULT 'Geral',
  item_type TEXT NOT NULL DEFAULT 'file',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_items ENABLE ROW LEVEL SECURITY;

-- RLS for document_templates
CREATE POLICY "templates_owner_read" ON public.document_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM companies WHERE companies.id = document_templates.company_id AND companies.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "templates_owner_insert" ON public.document_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM companies WHERE companies.id = document_templates.company_id AND companies.user_id = auth.uid())
  );

CREATE POLICY "templates_owner_update" ON public.document_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM companies WHERE companies.id = document_templates.company_id AND companies.user_id = auth.uid())
  );

CREATE POLICY "templates_owner_delete" ON public.document_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM companies WHERE companies.id = document_templates.company_id AND companies.user_id = auth.uid())
  );

-- RLS for document_template_items
CREATE POLICY "template_items_owner_read" ON public.document_template_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM document_templates dt
      JOIN companies c ON c.id = dt.company_id
      WHERE dt.id = document_template_items.template_id AND c.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "template_items_owner_insert" ON public.document_template_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_templates dt
      JOIN companies c ON c.id = dt.company_id
      WHERE dt.id = document_template_items.template_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "template_items_owner_update" ON public.document_template_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM document_templates dt
      JOIN companies c ON c.id = dt.company_id
      WHERE dt.id = document_template_items.template_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "template_items_owner_delete" ON public.document_template_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM document_templates dt
      JOIN companies c ON c.id = dt.company_id
      WHERE dt.id = document_template_items.template_id AND c.user_id = auth.uid()
    )
  );

-- Trigger for updated_at on templates
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();