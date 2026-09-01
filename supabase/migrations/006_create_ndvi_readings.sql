CREATE TABLE public.ndvi_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES public.plots(id) ON DELETE CASCADE NOT NULL,
  captured_date date NOT NULL, -- IST calendar date of the satellite pass, not UTC
  ndvi_mean numeric,
  ndvi_min numeric,
  ndvi_max numeric,
  cloud_cover_pct numeric,
  source text DEFAULT 'sentinel-2',
  is_synthetic boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plot_id, captured_date)
);

CREATE INDEX idx_ndvi_plot_date ON public.ndvi_readings(plot_id, captured_date DESC);
