import { useTranslation } from "../translation/useTranslation";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeading } from "./SectionHeading";
import {
  Activity,
  CloudRain,
  Compass,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Sun,
  Wind
} from "lucide-react";

export const DashboardPreview: React.FC = () => {
    const { t } = useTranslation();
  const [activeNutrient, setActiveNutrient] = useState<"N" | "P" | "K">("N");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  // Dummy Chart data path values based on selected nutrient
  const chartPaths = {
    N: "M 0 50 Q 20 20 40 45 T 80 15 T 120 30 T 160 10 T 200 40 T 240 25 T 280 45 T 320 20 T 360 35 T 400 15 T 440 28 T 480 8",
    P: "M 0 35 Q 20 45 40 15 T 80 40 T 120 20 T 160 30 T 200 15 T 240 45 T 280 25 T 320 38 T 360 18 T 400 30 T 440 10 T 480 25",
    K: "M 0 60 Q 20 35 40 50 T 80 25 T 120 45 T 160 20 T 200 35 T 240 10 T 280 30 T 320 15 T 360 40 T 400 22 T 440 35 T 480 12"
  };

  const weatherForecast = [
    { day: t('dashboardpreview.today'), temp: "31°", icon: <Sun className="w-4 h-4 text-amber-500" />, pop: "10%" },
    { day: t('dashboardpreview.sat'), temp: "29°", icon: <CloudRain className="w-4 h-4 text-sky-500" />, pop: "80%" },
    { day: t('dashboardpreview.sun'), temp: "30°", icon: <CloudRain className="w-4 h-4 text-sky-400" />, pop: "40%" },
    { day: t('dashboardpreview.mon'), temp: "32°", icon: <Sun className="w-4 h-4 text-amber-500" />, pop: "0%" },
    { day: t('dashboardpreview.tue'), temp: "33°", icon: <Sun className="w-4 h-4 text-amber-500" />, pop: "0%" }
  ];

  return (
    <section id="dashboard" className="py-24 bg-white relative overflow-hidden border-t border-gray-100">
      {/* Decorative Blur */}
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-[#66BB6A]/5 rounded-full filter blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <div className="mb-16 flex justify-center">
          <SectionHeading
            eyebrow={t('dashboardpreview.live_environment')}
            title={t('dashboardpreview.experience_the_farm_control_center')}
            description={t('dashboardpreview.an_intuitive_digital_twin')}
          />
        </div>

        {/* Laptop Container Mockup */}
        <motion.div
          className="relative max-w-5xl mx-auto rounded-2xl border border-gray-250 bg-[#F1F5F0] p-3 md:p-4 shadow-2xl shadow-gray-900/10 overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Laptop Top Bezel / Screen Housing */}
          <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[560px]">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-56 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-150 p-4 flex flex-col justify-between">
              <div>
                {/* Brand */}
                <div className="flex items-center gap-3 pb-6 border-b border-gray-150 mb-6">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white">
                    <svg className="w-4 h-4" viewBox="0 0 100 100" fill="none">
                      <path d="M50 75 Q50 50 50 35" stroke="white" strokeWidth="10" strokeLinecap="round" />
                      <path d="M50 55 C40 50 35 40 48 30" stroke="white" strokeWidth="8" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{t('dashboardpreview.nutripalm_console')}</span>
                </div>

                {/* Nav items */}
                <nav className="flex flex-col gap-1 text-left">
                  <span className="px-3 py-2 rounded-lg text-xs font-bold bg-[#2E7D32]/10 text-primary flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />  {t('dashboardpreview.dashboard')}
                                                        </span>
                  <span className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5" />  {t('dashboardpreview.field_twin')}
                                                        </span>
                  <span className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5" />  {t('dashboardpreview.soil_reports')}
                                                        </span>
                </nav>
              </div>

              {/* Farmer Signout card */}
              <div className="pt-4 border-t border-gray-150 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs">{t('dashboardpreview.so')}</div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-gray-800">{t('dashboardpreview.samruddhi_farm')}</span>
                  <span className="text-[8px] text-gray-400">{t('dashboardpreview.premium_account')}</span>
                </div>
              </div>
            </div>

            {/* Dashboard Content Panel */}
            <div className="flex-1 bg-white p-5 flex flex-col justify-between overflow-y-auto">
              
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                <div className="text-left">
                  <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-wider block">{t('dashboardpreview.field_status')}</span>
                  <h3 className="text-lg font-extrabold text-gray-950 flex items-center gap-2">
                    
                                                          {t('dashboardpreview.plot_b_maize_crop_rotation')}
                                                        </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSync}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all text-gray-600 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? t('dashboardpreview.syncing') : t('dashboardpreview.sync_telemetry')}
                  </button>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-3 py-1 rounded-full">
                    
                                                          {t('dashboardpreview.twin_live')}
                                                        </span>
                </div>
              </div>

              {/* Quick Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div className="p-3.5 rounded-xl border border-gray-150/80 bg-gray-50/50 text-left">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{t('dashboardpreview.soil_moisture')}</span>
                  <span className="text-base font-extrabold text-gray-900 block mt-0.5">28.4%</span>
                  <div className="w-full bg-gray-200 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="w-[28%] h-full bg-sky-500" />
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-gray-150/80 bg-gray-50/50 text-left">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{t('dashboardpreview.organic_carbon')}</span>
                  <span className="text-base font-extrabold text-gray-900 block mt-0.5">1.28%</span>
                  <span className="text-[8px] font-bold text-green-600">{t('dashboardpreview.rich_quality')}</span>
                </div>
                <div className="p-3.5 rounded-xl border border-gray-150/80 bg-gray-50/50 text-left">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{t('dashboardpreview.crop_health')}</span>
                  <span className="text-base font-extrabold text-gray-900 block mt-0.5">{t('dashboardpreview.92_100')}</span>
                  <span className="text-[8px] font-bold text-green-600">{t('dashboardpreview.excellent_ndvi')}</span>
                </div>
                <div className="p-3.5 rounded-xl border border-gray-150/80 bg-gray-50/50 text-left">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{t('dashboardpreview.soil_ph')}</span>
                  <span className="text-base font-extrabold text-gray-900 block mt-0.5">{t('dashboardpreview.6_48_ph')}</span>
                  <span className="text-[8px] font-bold text-amber-500">{t('dashboardpreview.slightly_acidic')}</span>
                </div>
              </div>

              {/* Lower Section (Charts & Advisory Widgets) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">
                
                {/* Left Area: Soil telemetry line chart */}
                <div className="lg:col-span-8 border border-gray-150 rounded-xl p-4 flex flex-col justify-between bg-white text-left">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-gray-800">{t('dashboardpreview.historical_nutrient_trend')}</span>
                    </div>
                    {/* Nutrient Toggles */}
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                      {(["N", "P", "K"] as const).map((nutrient) => (
                        <button
                          key={nutrient}
                          onClick={() => setActiveNutrient(nutrient)}
                          className={`text-[9px] font-extrabold px-2 py-1 rounded-md transition-all ${
                            activeNutrient === nutrient
                              ? "bg-white text-primary shadow-sm"
                              : "text-gray-400 hover:text-gray-700"
                          }`}
                        >
                          {nutrient}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart SVG */}
                  <div className="relative h-32 w-full bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex items-center justify-center p-2">
                    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:20px_20px]" />
                    
                    <svg className="w-full h-full text-primary" viewBox="0 0 480 80" preserveAspectRatio="none">
                      <AnimatePresence mode="wait">
                        <motion.path
                          key={activeNutrient}
                          d={chartPaths[activeNutrient]}
                          fill="none"
                          stroke={activeNutrient === "N" ? "#2E7D32" : activeNutrient === "P" ? "#66BB6A" : "#3182ce"}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6 }}
                        />
                      </AnimatePresence>
                    </svg>

                    {/* SVG Bottom fade overlay */}
                    <div className="absolute bottom-2 left-3 text-[8px] font-bold text-gray-400">
                      
                                                                {t('dashboardpreview.sensor_logs_14_days')}
                                                              </div>
                  </div>

                  {/* Forecast details */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                    <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5 text-gray-400" />  {t('dashboardpreview.wind_speed_12_km_h')}
                                                              </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      
                                                                {t('dashboardpreview.next_soil_report_due_aug_5')}
                                                              </span>
                  </div>
                </div>

                {/* Right Area: Weather and Advisory */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {/* Weather Widget */}
                  <div className="border border-gray-150 rounded-xl p-3.5 bg-gray-50/50 flex flex-col justify-between flex-1 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{t('dashboardpreview.precipitation_forecast')}</span>
                      <CloudRain className="w-4 h-4 text-sky-500 animate-bounce" />
                    </div>
                    
                    {/* Forecast columns */}
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {weatherForecast.map((w, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <span className="text-[8px] font-semibold text-gray-400">{w.day}</span>
                          {w.icon}
                          <span className="text-[9px] font-bold text-gray-800">{w.temp}</span>
                          <span className="text-[7px] text-sky-600 font-bold">{w.pop}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendation / Alert Widget */}
                  <div className="border border-red-100 rounded-xl p-3.5 bg-red-50/40 text-left flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-extrabold text-red-700 uppercase tracking-wide">{t('dashboardpreview.ai_recommendation')}</span>
                      <span className="text-xs font-extrabold text-gray-800 mt-0.5">{t('dashboardpreview.high_nitrogen_anomaly')}</span>
                      <p className="text-[10px] text-gray-500 leading-snug mt-1">
                        
                                                                      {t('dashboardpreview.reduce_npk_19_19_19_dosage_by_15_to_avoi')}
                                                                    </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
