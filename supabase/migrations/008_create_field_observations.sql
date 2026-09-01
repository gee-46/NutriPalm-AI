CREATE TABLE public.field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES public.plots(id) ON DELETE CASCADE NOT NULL,
  observed_at timestamptz NOT NULL,
  observation_type text CHECK (observation_type IN ('fertilizer_applied','irrigation','pest_sighting','soil_report','ingestion_gap','other')),
  payload jsonb,
  logged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_field_obs_plot_date ON public.field_observations(plot_id, observed_at DESC);
