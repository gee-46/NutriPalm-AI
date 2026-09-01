ALTER TABLE public.digital_twins
  ADD COLUMN IF NOT EXISTS temperature_c numeric,
  ADD COLUMN IF NOT EXISTS humidity_pct numeric,
  ADD COLUMN IF NOT EXISTS rainfall_mm numeric,
  ADD COLUMN IF NOT EXISTS soil_health_index numeric,
  ADD COLUMN IF NOT EXISTS foliar_health_score numeric,
  ADD COLUMN IF NOT EXISTS data_completeness jsonb,
  ADD COLUMN IF NOT EXISTS is_synthetic boolean DEFAULT false;

-- Add a unique constraint to support upserts from the snapshot service
ALTER TABLE public.digital_twins 
  DROP CONSTRAINT IF EXISTS digital_twins_plot_id_analysis_date_key;

ALTER TABLE public.digital_twins 
  ADD CONSTRAINT digital_twins_plot_id_analysis_date_key UNIQUE (plot_id, analysis_date);
