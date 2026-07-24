
ALTER TABLE public.optimizations
  ADD COLUMN IF NOT EXISTS confidence_rank int
  GENERATED ALWAYS AS (
    CASE confidence
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
      ELSE 0
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS optimizations_org_savings_idx
  ON public.optimizations (org_id, savings_usd DESC);
CREATE INDEX IF NOT EXISTS optimizations_org_created_idx
  ON public.optimizations (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS optimizations_org_confidence_idx
  ON public.optimizations (org_id, confidence_rank DESC);
CREATE INDEX IF NOT EXISTS optimizations_org_type_idx
  ON public.optimizations (org_id, type);
