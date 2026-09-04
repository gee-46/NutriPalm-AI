import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  district?: string;
  state?: string;
  village?: string;
  preferred_language?: string;
}

export interface SoilReportData {
  id: string;
  plot_id: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  organic_carbon: number;
  ph: number;
  electrical_conductivity?: number;
  status: string;
  report_date: string;
}

export interface DigitalTwinData {
  id: string;
  plot_id: string;
  crop_health_score: number;
  water_stress_score: number;
  nutrient_health_score: number;
  growth_stage: string;
  yield_prediction: number;
  risk_level: string;
  updated_at?: string;
}

export interface PlotData {
  id: string;
  name: string;
  crop: string;
  area: number;
  area_unit: string;
  soil: string;
  status: string;
  boundary?: any;
  digital_twins?: DigitalTwinData[];
  soil_reports?: SoilReportData[];
}

// ---------------------------------------------------------------------------
// Robust Mock Fallback Data (Matching SEED_PLOTS in plots.ts)
// ---------------------------------------------------------------------------
const MOCK_PROFILE: ProfileData = {
  id: "mock-user",
  full_name: "Swaminathan Gowda",
  email: "swamy.g@gmail.com",
  district: "Dakshina Kannada",
  state: "Karnataka",
  village: "Rangampeta",
  preferred_language: "Kannada"
};

const MOCK_PLOTS: PlotData[] = [
  {
    id: "plot-1",
    name: "Swamy North Plot (Plot 2A)",
    crop: "Oil Palm",
    area: 12.5,
    area_unit: "acres",
    soil: "Loamy (Optimal)",
    status: "Healthy",
    digital_twins: [
      {
        id: "twin-1",
        plot_id: "plot-1",
        crop_health_score: 88,
        water_stress_score: 42,
        nutrient_health_score: 85,
        growth_stage: "Fruit Development",
        yield_prediction: 18.6,
        risk_level: "Low"
      }
    ],
    soil_reports: [
      {
        id: "report-1",
        plot_id: "plot-1",
        nitrogen: 135,
        phosphorus: 24,
        potassium: 160,
        organic_carbon: 1.82,
        ph: 5.85,
        electrical_conductivity: 1.2,
        status: "Completed",
        report_date: "2026-07-25"
      }
    ]
  },
  {
    id: "plot-2",
    name: "Kothagudem South Field",
    crop: "Oil Palm",
    area: 8.2,
    area_unit: "acres",
    soil: "Red Clayey",
    status: "Moderate",
    digital_twins: [
      {
        id: "twin-2",
        plot_id: "plot-2",
        crop_health_score: 72,
        water_stress_score: 38,
        nutrient_health_score: 70,
        growth_stage: "Flowering",
        yield_prediction: 13.0,
        risk_level: "Low"
      }
    ],
    soil_reports: [
      {
        id: "report-2",
        plot_id: "plot-2",
        nitrogen: 110,
        phosphorus: 18,
        potassium: 140,
        organic_carbon: 1.45,
        ph: 6.2,
        electrical_conductivity: 0.95,
        status: "Completed",
        report_date: "2026-07-22"
      }
    ]
  },
  {
    id: "plot-3",
    name: "Devamma Palm Zone 1",
    crop: "Coconut Palm",
    area: 5.0,
    area_unit: "acres",
    soil: "Sandy Clay",
    status: "Needs Attention",
    digital_twins: [
      {
        id: "twin-3",
        plot_id: "plot-3",
        crop_health_score: 55,
        water_stress_score: 46,
        nutrient_health_score: 52,
        growth_stage: "Flowering",
        yield_prediction: 6.5,
        risk_level: "Moderate"
      }
    ],
    soil_reports: [
      {
        id: "report-3",
        plot_id: "plot-3",
        nitrogen: 90,
        phosphorus: 12,
        potassium: 115,
        organic_carbon: 1.1,
        ph: 5.4,
        electrical_conductivity: 0.8,
        status: "Completed",
        report_date: "2026-07-20"
      }
    ]
  },
  {
    id: "plot-4",
    name: "Swamy East Plantation",
    crop: "Oil Palm",
    area: 7.8,
    area_unit: "acres",
    soil: "Loamy (Optimal)",
    status: "Healthy",
    digital_twins: [
      {
        id: "twin-4",
        plot_id: "plot-4",
        crop_health_score: 79,
        water_stress_score: 40,
        nutrient_health_score: 76,
        growth_stage: "Fruiting",
        yield_prediction: 10.2,
        risk_level: "Low"
      }
    ],
    soil_reports: [
      {
        id: "report-4",
        plot_id: "plot-4",
        nitrogen: 125,
        phosphorus: 20,
        potassium: 150,
        organic_carbon: 1.6,
        ph: 5.8,
        electrical_conductivity: 1.1,
        status: "Completed",
        report_date: "2026-07-15"
      }
    ]
  },
  {
    id: "plot-5",
    name: "Hassan Cocoa Plot",
    crop: "Cocoa",
    area: 6.0,
    area_unit: "acres",
    soil: "Sandy Loam",
    status: "Critical",
    digital_twins: [
      {
        id: "twin-5",
        plot_id: "plot-5",
        crop_health_score: 38,
        water_stress_score: 28,
        nutrient_health_score: 40,
        growth_stage: "Vegetative",
        yield_prediction: 2.1,
        risk_level: "Critical"
      }
    ],
    soil_reports: [
      {
        id: "report-5",
        plot_id: "plot-5",
        nitrogen: 70,
        phosphorus: 8,
        potassium: 90,
        organic_carbon: 0.85,
        ph: 5.2,
        electrical_conductivity: 0.6,
        status: "Completed",
        report_date: "2026-07-10"
      }
    ]
  }
];

export function useFarmerAnalytics() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileData>(MOCK_PROFILE);
  const [plots, setPlots] = useState<PlotData[]>(MOCK_PLOTS);
  const [selectedPlotId, setSelectedPlotId] = useState<string | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Authenticated state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setCurrentUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch real database records
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!currentUser) {
        // Fall back to mock values immediately if logged out
        setProfile(MOCK_PROFILE);
        setPlots(MOCK_PLOTS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch Farmer Profile
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone_number, district, state, village, preferred_language")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (profileErr) throw profileErr;
        
        // 2. Fetch Plots with linked Digital Twins & Soil Lab Reports (with soft try-catch on joins)
        // Since soil_reports might not exist as a table, we first fetch plots & twins.
        const { data: plotsData, error: plotsErr } = await supabase
          .from("plots")
          .select(`
            id, name, crop, area, area_unit, soil, status, boundary,
            digital_twins (
              id, plot_id, crop_health_score, water_stress_score, nutrient_health_score,
              growth_stage, yield_prediction, risk_level
            )
          `)
          .eq("owner_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (plotsErr) throw plotsErr;

        let finalPlots: PlotData[] = (plotsData || []).map((p: any) => ({
          ...p,
          soil_reports: [] // Will populate if table exists
        }));

        // Try querying soil reports separately
        try {
          const { data: reportsData, error: reportsErr } = await supabase
            .from("soil_reports")
            .select("id, plot_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, electrical_conductivity, status, created_at")
            .eq("owner_id", currentUser.id);

          if (!reportsErr && reportsData) {
            const mappedReports = reportsData.map((r: any) => ({
              id: r.id,
              plot_id: r.plot_id,
              nitrogen: r.nitrogen_kg_ha,
              phosphorus: r.phosphorus_kg_ha,
              potassium: r.potassium_kg_ha,
              organic_carbon: r.organic_carbon_percent,
              ph: r.ph,
              electrical_conductivity: r.electrical_conductivity,
              status: r.status,
              report_date: r.created_at ? r.created_at.split("T")[0] : new Date().toISOString().split("T")[0]
            }));

            finalPlots = finalPlots.map((p) => ({
              ...p,
              soil_reports: mappedReports.filter((r: any) => r.plot_id === p.id)
            }));
          } else if (reportsErr) {
            console.error("Supabase query error fetching soil reports:", reportsErr);
          }
        } catch (e) {
          console.warn("soil_reports table not queryable, falling back to mock soil reports");
          // Add default mock reports so calculations don't break
          finalPlots = finalPlots.map((p) => {
            const mock = MOCK_PLOTS.find((mp) => mp.crop.toLowerCase() === p.crop.toLowerCase()) || MOCK_PLOTS[0];
            return {
              ...p,
              soil_reports: [
                {
                  id: `report-${p.id}`,
                  plot_id: p.id,
                  nitrogen: mock.soil_reports?.[0]?.nitrogen || 120,
                  phosphorus: mock.soil_reports?.[0]?.phosphorus || 20,
                  potassium: mock.soil_reports?.[0]?.potassium || 140,
                  organic_carbon: mock.soil_reports?.[0]?.organic_carbon || 1.4,
                  ph: mock.soil_reports?.[0]?.ph || 5.8,
                  electrical_conductivity: 1.0,
                  status: "Completed",
                  report_date: new Date().toISOString().split("T")[0]
                }
              ]
            };
          });
        }

        if (active) {
          if (profileData) setProfile(profileData);
          // If the user has no plots in DB, let setPlots receive [] to show onboarding
          setPlots(finalPlots);
        }
      } catch (err) {
        console.error("Supabase ingestion failed, using fallback mocks:", err);
        if (active) {
          setProfile(MOCK_PROFILE);
          setPlots(MOCK_PLOTS);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [currentUser]);

  // ---------------------------------------------------------------------------
  // Calculations Engine
  // ---------------------------------------------------------------------------
  const totalAcres = plots.reduce((sum, p) => sum + p.area, 0);

  const getComputedData = () => {
    if (plots.length === 0) {
      return {
        acres: 0,
        avgCropHealth: 0,
        cropDistribution: [],
        soilNutrients: { N: 0, P: 0, K: 0, OC: 0, pH: 0 },
        yieldDelta: 0,
        canopyStress: "Optimal",
        waterDeficit: 0,
        soilStatus: "Pending Scan",
        telemetryStatus: "Offline",
        growthStage: "N/A"
      };
    }

    if (selectedPlotId === "ALL") {
      // 1. Total acres
      const acres = totalAcres;

      // 2. Weighted average crop health score
      let weightedHealthSum = 0;
      let totalAreaForHealth = 0;
      plots.forEach((p) => {
        const twin = p.digital_twins?.[0];
        const health = twin && !Number.isNaN(Number(twin.crop_health_score)) ? Number(twin.crop_health_score) : 75;
        weightedHealthSum += health * (p.area || 1);
        totalAreaForHealth += (p.area || 1);
      });
      const avgCropHealth = totalAreaForHealth > 0 ? Math.round(weightedHealthSum / totalAreaForHealth) : 75;

      // 3. Crop Distribution
      const cropMap: Record<string, number> = {};
      plots.forEach((p) => {
        const cropName = p.crop || "Unknown Crop";
        cropMap[cropName] = (cropMap[cropName] || 0) + (p.area || 0);
      });
      const cropDistribution = Object.keys(cropMap).map((crop) => ({
        name: crop,
        acres: cropMap[crop],
        pct: totalAcres > 0 ? Math.round((cropMap[crop] / totalAcres) * 100) : 0
      }));

      // 4. Average soil macronutrients
      let sumN = 0, sumP = 0, sumK = 0, sumOC = 0, sumPH = 0;
      let reportCount = 0;
      plots.forEach((p) => {
        const report = p.soil_reports?.[0];
        if (report) {
          sumN += Number(report.nitrogen) || 0;
          sumP += Number(report.phosphorus) || 0;
          sumK += Number(report.potassium) || 0;
          sumOC += Number(report.organic_carbon) || 0;
          sumPH += Number(report.ph) || 0;
          reportCount++;
        }
      });
      const soilNutrients = {
        N: reportCount > 0 ? Math.round(sumN / reportCount) : 120,
        P: reportCount > 0 ? Math.round(sumP / reportCount) : 20,
        K: reportCount > 0 ? Math.round(sumK / reportCount) : 140,
        OC: reportCount > 0 ? Number((sumOC / reportCount).toFixed(2)) : 1.4,
        pH: reportCount > 0 ? Number((sumPH / reportCount).toFixed(2)) : 5.8
      };

      // 5. Yield Improvement Average
      let sumYield = 0;
      plots.forEach((p) => {
        const twin = p.digital_twins?.[0];
        const val = twin && !Number.isNaN(Number(twin.yield_prediction)) ? Number(twin.yield_prediction) : 18.2;
        sumYield += val > 100 ? val / 10 : val; 
      });
      const yieldDelta = plots.length > 0 ? Number((sumYield / plots.length).toFixed(1)) : 18.2;

      // 6. Water stress
      let sumWater = 0;
      plots.forEach((p) => {
        const twin = p.digital_twins?.[0];
        sumWater += twin && !Number.isNaN(Number(twin.water_stress_score)) ? Number(twin.water_stress_score) : 40;
      });
      const avgWaterDeficit = plots.length > 0 ? Math.round(sumWater / plots.length) : 40;
      let canopyStress = "Optimal";
      if (avgWaterDeficit < 30) canopyStress = "High Stress";
      else if (avgWaterDeficit < 60) canopyStress = "Moderate Risk";

      return {
        acres,
        avgCropHealth,
        cropDistribution,
        soilNutrients,
        yieldDelta,
        canopyStress,
        waterDeficit: avgWaterDeficit,
        soilStatus: "Report Analyzed",
        telemetryStatus: "Live Active Sync",
        growthStage: "Mixed Canopy"
      };
    } else {
      // Single Plot Mode
      const plot = plots.find((p) => p.id === selectedPlotId);
      if (!plot) return getComputedData(); // fallback

      const twin = plot.digital_twins?.[0];
      const report = plot.soil_reports?.[0];

      const cropDistribution = [
        { name: plot.crop, acres: plot.area, pct: 100 }
      ];

      const health = twin ? Number(twin.crop_health_score) : 75;
      const waterDeficit = twin ? Number(twin.water_stress_score) : 40;
      let canopyStress = "Optimal";
      if (waterDeficit < 35) canopyStress = "High Stress";
      else if (waterDeficit < 65) canopyStress = "Moderate Risk";

      const soilNutrients = {
        N: report ? Number(report.nitrogen) : 120,
        P: report ? Number(report.phosphorus) : 20,
        K: report ? Number(report.potassium) : 140,
        OC: report ? Number(report.organic_carbon) : 1.4,
        pH: report ? Number(report.ph) : 5.8
      };

      const yieldVal = twin ? Number(twin.yield_prediction) : 18.2;
      const yieldDelta = yieldVal > 100 ? yieldVal / 10 : yieldVal;

      return {
        acres: plot.area,
        avgCropHealth: health,
        cropDistribution,
        soilNutrients,
        yieldDelta,
        canopyStress,
        waterDeficit,
        soilStatus: report ? "Report Analyzed" : "Pending Scan",
        telemetryStatus: twin ? "Live Active Sync" : "Offline",
        growthStage: twin ? twin.growth_stage : "Seedling"
      };
    }
  };

  return {
    isLoading,
    profile,
    plots,
    selectedPlotId,
    setSelectedPlotId,
    analyticsData: getComputedData()
  };
}
