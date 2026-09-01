CREATE TABLE public.weather_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES public.plots(id) ON DELETE CASCADE NOT NULL,
  observed_date date NOT NULL, -- IST calendar date
  temperature_c numeric,
  humidity_pct numeric,
  rainfall_mm numeric,
  wind_kph numeric,
  solar_radiation numeric,
  source text,
  is_synthetic boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plot_id, observed_date)
);

CREATE INDEX idx_weather_plot_date ON public.weather_observations(plot_id, observed_date DESC);
