
ALTER TABLE public.attacks
  ADD COLUMN IF NOT EXISTS owasp_id text,
  ADD COLUMN IF NOT EXISTS compliance_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS attacks_category_idx ON public.attacks(category);
CREATE INDEX IF NOT EXISTS attacks_owasp_idx ON public.attacks(owasp_id);
