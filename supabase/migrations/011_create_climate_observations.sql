CREATE TABLE public.climate_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_id uuid REFERENCES public.plots(id) ON DELETE CASCADE NOT NULL,
    temperature numeric,
    humidity numeric,
    rainfall_mm numeric,
    recorded_at timestamptz NOT NULL,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.climate_observations ENABLE ROW LEVEL SECURITY;

-- Select policy: User can only select observations for their own plots
CREATE POLICY "Users can select climate observations for their own plots"
    ON public.climate_observations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.plots
            WHERE plots.id = climate_observations.plot_id
            AND plots.owner_id = auth.uid()
        )
    );

-- Insert policy: User can insert observations for their own plots
CREATE POLICY "Users can insert climate observations for their own plots"
    ON public.climate_observations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.plots
            WHERE plots.id = climate_observations.plot_id
            AND plots.owner_id = auth.uid()
        )
    );

-- Delete policy: User can delete observations for their own plots
CREATE POLICY "Users can delete climate observations for their own plots"
    ON public.climate_observations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.plots
            WHERE plots.id = climate_observations.plot_id
            AND plots.owner_id = auth.uid()
        )
    );
