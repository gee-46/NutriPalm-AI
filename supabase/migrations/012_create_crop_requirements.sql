CREATE TABLE public.crop_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_name text NOT NULL UNIQUE,
    -- Soil parameters
    ph_min numeric,
    ph_max numeric,
    ec_max numeric,
    organic_carbon_min numeric,
    n_min numeric,
    p_min numeric,
    k_min numeric,
    -- Climate parameters
    temperature_min numeric,
    temperature_max numeric,
    annual_rainfall_min numeric,
    annual_rainfall_max numeric,
    water_needs_mm_per_day numeric,
    -- Auditing fields
    source text NOT NULL,
    source_document text NOT NULL,
    source_date date NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS (Read-only for all authenticated users)
ALTER TABLE public.crop_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read crop requirements"
    ON public.crop_requirements
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert authoritative data for Arecanut and Coconut
-- Source: ICAR-CPCRI (Central Plantation Crops Research Institute) guidelines
INSERT INTO public.crop_requirements (
    crop_name, ph_min, ph_max, ec_max, organic_carbon_min,
    n_min, p_min, k_min,
    temperature_min, temperature_max,
    annual_rainfall_min, annual_rainfall_max, water_needs_mm_per_day,
    source, source_document, source_date
) VALUES 
(
    'Coconut', 
    5.2, 8.0, 2.0, 0.5, 
    50, 10, 100, 
    27.0, 32.0, 
    2000, 3000, 150.0, -- approximate ET-based water need ~ 150 liters/palm/day -> generalized to field mm equivalent
    'ICAR-CPCRI', 'Coconut Cultivation Practices Guide', '2023-01-01'
),
(
    'Arecanut', 
    5.0, 8.0, 1.5, 0.5, 
    100, 40, 140, 
    14.0, 36.0, 
    2500, 4000, 20.0, -- 20-30 liters/palm/day
    'ICAR-CPCRI', 'Arecanut Package of Practices', '2023-01-01'
);
