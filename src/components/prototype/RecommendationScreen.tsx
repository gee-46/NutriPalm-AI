import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, Sparkles, Calendar, AlertTriangle, Leaf, DollarSign, 
  Download, Share2, ClipboardCheck, CloudRain, RefreshCw
} from "lucide-react";

interface RecommendationScreenProps {
  onLoad?: () => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

// Premium Animated Counter Component
const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = easeProgress * value;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span>
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
      {suffix}
    </span>
  );
};

export const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ 
  onLoad,
  showToast
}) => {
    const { t } = useTranslation();
  useEffect(() => {
    if (onLoad) onLoad();
  }, [onLoad]);

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerateNew = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      triggerToast("AI Recommendation Engine re-computed diagnostics from telemetry.", "success");
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left relative"
    >
      {/* Loading shroud overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/70 backdrop-blur-xs z-30 pointer-events-auto rounded-3xl flex items-center justify-center"
          >
            <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-xl flex items-center gap-3">
              <RefreshCwSpinner />
              <span className="text-xs font-black text-gray-800">{t('recommendationscreen.recalibrating_agronomical_recommendation')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" />
            
                                  {t('recommendationscreen.ai_crop_recommendation_engine')}
                                </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            
                                  {t('recommendationscreen.ai_generated_precision_agriculture_recom')}
                                </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-xs cursor-pointer border-0"
          >
            <Sparkles className="w-4 h-4 text-white fill-white/20 animate-pulse" />
            
                                  {t('recommendationscreen.generate_new_recommendation')}
                                </button>
          
          <button
            onClick={() => triggerToast("Compiling PDF advisory report...", "info")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            
                                  {t('recommendationscreen.export_pdf')}
                                </button>

          <button
            onClick={() => triggerToast("Copied advisory token to clipboard.", "success")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-gray-500" />
            
                                  {t('recommendationscreen.share_report')}
                                </button>
        </div>
      </div>

      {/* ================= SECTION 1 — Farm Summary ================= */}
      <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4 text-xs font-semibold text-gray-700">
        <div className="space-y-1">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.farmer')}</span>
          <span className="text-gray-900 font-black block">{t('recommendationscreen.s_gowda')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.farm_plot')}</span>
          <span className="text-gray-900 font-black block">{t('recommendationscreen.plot_2a')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.crop_type')}</span>
          <span className="text-primary font-black block">{t('recommendationscreen.oil_palm')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.area')}</span>
          <span className="text-gray-900 font-black block">{t('recommendationscreen.12_5_acres')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.growth_phase')}</span>
          <span className="text-gray-900 font-black block">{t('recommendationscreen.fruit_dev')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.last_soil_scan')}</span>
          <span className="text-emerald-650 font-black block flex items-center gap-1">{t('recommendationscreen.complete')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.weather_index')}</span>
          <span className="text-emerald-650 font-black block flex items-center gap-1">{t('recommendationscreen.storm_alert_none')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.digital_twin')}</span>
          <span className="text-emerald-650 font-black block flex items-center gap-1">{t('recommendationscreen.calibrated')}</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.overall_health')}</span>
          <span className="text-white bg-[#2E7D32] px-2 py-0.5 rounded-md font-bold block text-center">87%</span>
        </div>
      </div>

      {/* ================= LAYOUT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Summary hero card, dosage table, Why explainers, ROI, environmental, timeline (8/12 width) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SECTION 2 — AI Recommendation Summary */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50/40 rounded-full filter blur-3xl pointer-events-none" />
            
            <div className="space-y-6 text-left">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                    
                                                          {t('recommendationscreen.slow_release_organic_carrier')}
                                                        </span>
                  <h3 className="text-xl font-black text-gray-900 mt-4">{t('recommendationscreen.npk_20_10_10_organic_compost')}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-gray-400 block uppercase">{t('recommendationscreen.priority_level')}</span>
                  <span className="text-rose-600 font-black text-sm bg-rose-50 border border-rose-100 px-3 py-1 rounded-xl">{t('recommendationscreen.high')}</span>
                </div>
              </div>

              {/* Progress counter fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">{t('recommendationscreen.confidence_score')}</span>
                  <span className="text-xl font-black text-gray-950 mt-1 block">
                    <AnimatedCounter value={96} suffix="%" />
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">{t('recommendationscreen.yield_increase')}</span>
                  <span className="text-xl font-black text-primary mt-1 block">
                    <AnimatedCounter value={18} suffix="%" />
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">{t('recommendationscreen.soil_improvement')}</span>
                  <span className="text-xl font-black text-primary mt-1 block">
                    <AnimatedCounter value={12} suffix="%" />
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">{t('recommendationscreen.application_window')}</span>
                  <span className="text-sm font-black text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg mt-2.5 inline-block">{t('recommendationscreen.within_5_days')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3 — Dosage Plan */}
          <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-gray-100">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('recommendationscreen.advisory_dosage_specification')}</h4>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-150 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="p-4 pl-6">{t('recommendationscreen.fertilizer_component')}</th>
                    <th className="p-4">{t('recommendationscreen.quantity_acre')}</th>
                    <th className="p-4">{t('recommendationscreen.application_method')}</th>
                    <th className="p-4">{t('recommendationscreen.frequency')}</th>
                    <th className="p-4 pr-6">{t('recommendationscreen.optimal_timing')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-semibold">
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-950">{t('recommendationscreen.npk_20_10_10')}</td>
                    <td className="p-4 text-gray-800">{t('recommendationscreen.50_kg_acre')}</td>
                    <td className="p-4">{t('recommendationscreen.soil_broadcast_ring')}</td>
                    <td className="p-4">{t('recommendationscreen.once')}</td>
                    <td className="p-4 text-primary font-bold pr-6">{t('recommendationscreen.morning_hours_pre_noon')}</td>
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-950">{t('recommendationscreen.organic_compost')}</td>
                    <td className="p-4 text-gray-800">{t('recommendationscreen.250_kg_acre')}</td>
                    <td className="p-4">{t('recommendationscreen.manual_root_zone_mounding')}</td>
                    <td className="p-4">{t('recommendationscreen.once')}</td>
                    <td className="p-4 text-primary font-bold pr-6">{t('recommendationscreen.week_1_basal_base')}</td>
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-950">{t('recommendationscreen.micronutrient_spray')}</td>
                    <td className="p-4 text-gray-800">{t('recommendationscreen.2_l_acre')}</td>
                    <td className="p-4">{t('recommendationscreen.foliar_canopy_misting')}</td>
                    <td className="p-4">{t('recommendationscreen.every_14_days')}</td>
                    <td className="p-4 text-primary font-bold pr-6">{t('recommendationscreen.late_evening_pre_sunset')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4 — Why AI Generated This (AI Reasoning) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-left">{t('recommendationscreen.model_explainability_reasoning')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Reason 1 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0"><AlertTriangle className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">{t('recommendationscreen.low_nitrogen_detected')}</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">{t('recommendationscreen.98_conf')}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    
                                                          {t('recommendationscreen.current_soil_nitrogen_levels_are_below_t')}
                                                        </p>
                </div>
              </div>

              {/* Reason 2 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0"><AlertTriangle className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">{t('recommendationscreen.low_organic_carbon')}</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">{t('recommendationscreen.94_conf')}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    
                                                          {t('recommendationscreen.organic_matter_density_index_is_low_rest')}
                                                        </p>
                </div>
              </div>

              {/* Reason 3 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-blue-50 text-blue-500 rounded-xl shrink-0"><CloudRain className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">{t('recommendationscreen.rain_forecast_absorption')}</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">{t('recommendationscreen.89_conf')}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    
                                                          {t('recommendationscreen.precipitation_indices_forecast_rain_in_4')}
                                                        </p>
                </div>
              </div>

              {/* Reason 4 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-emerald-50 text-primary rounded-xl shrink-0"><Bot className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">{t('recommendationscreen.digital_twin_prediction')}</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">{t('recommendationscreen.96_conf')}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    
                                                          {t('recommendationscreen.canopy_simulation_models_predict_fruit_b')}
                                                        </p>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 5 — Expected Improvements Comparisons */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-6">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('recommendationscreen.projected_improvement_forecasts')}</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Yield comparison */}
              <div className="space-y-3.5 border-r border-gray-100 pr-5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-extrabold text-gray-800">{t('recommendationscreen.fruit_bunch_yield')}</span>
                  <span className="text-xs font-black text-primary bg-emerald-50 px-2 py-0.5 rounded-full">{t('recommendationscreen.18_2_gain')}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.current_yield')}</span>
                    <span className="text-base font-black text-gray-700">{t('recommendationscreen.3_8_tons_ha')}</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-250/20 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-primary uppercase">{t('recommendationscreen.predicted_yield')}</span>
                    <span className="text-base font-black text-primary">{t('recommendationscreen.4_5_tons_ha')}</span>
                  </div>
                </div>
              </div>

              {/* Soil Health comparison */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-extrabold text-gray-800">{t('recommendationscreen.soil_health_score')}</span>
                  <span className="text-xs font-black text-primary bg-emerald-50 px-2 py-0.5 rounded-full">{t('recommendationscreen.12_0_gain')}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-gray-400 uppercase">{t('recommendationscreen.current_soil')}</span>
                    <span className="text-base font-black text-gray-700">{t('recommendationscreen.76_vigor')}</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-250/20 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-primary uppercase">{t('recommendationscreen.predicted_soil')}</span>
                    <span className="text-base font-black text-primary">{t('recommendationscreen.88_vigor')}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Extra Progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-gray-100 text-xs">
              <div className="space-y-1 font-semibold">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.water_usage_reduction')}</span>
                  <span className="text-primary">{t('recommendationscreen.12_saved')}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "12%" }} />
                </div>
              </div>
              <div className="space-y-1 font-semibold">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.fertilizer_absorption_efficiency')}</span>
                  <span className="text-primary">{t('recommendationscreen.15_gain')}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "15%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 7 — Cost & ROI & SECTION 8 — Sustainability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Cost & ROI card */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs text-left space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" />  {t('recommendationscreen.cost_benefit_valuation')}
                                            </h4>
              <div className="space-y-2.5 text-xs text-gray-700 font-semibold">
                <div className="flex justify-between">
                  <span>{t('recommendationscreen.estimated_fertilizer_cost')}</span>
                  <span className="text-gray-900">{t('recommendationscreen.185')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('recommendationscreen.estimated_labor_cost')}</span>
                  <span className="text-gray-900">{t('recommendationscreen.40')}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-gray-50 font-bold">
                  <span>{t('recommendationscreen.total_capital_outlay')}</span>
                  <span className="text-gray-950 font-black">{t('recommendationscreen.225')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.expected_gross_revenue_increase')}</span>
                  <span className="text-primary font-black">{t('recommendationscreen.540')}</span>
                </div>
                
                {/* ROI Badge */}
                <div className="bg-emerald-50 border border-emerald-150/40 p-3 rounded-2xl flex justify-between items-center text-xs mt-2">
                  <span className="font-extrabold text-emerald-850">{t('recommendationscreen.estimated_roi_rate')}</span>
                  <span className="text-lg font-black text-primary">{t('recommendationscreen.140_roi')}</span>
                </div>

                <div className="flex justify-between text-[10px] pt-1 text-gray-400 font-black uppercase">
                  <span>{t('recommendationscreen.break_even_period_28_days')}</span>
                  <span>{t('recommendationscreen.confidence_96')}</span>
                </div>
              </div>
            </div>

            {/* Environmental Impact card */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs text-left space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-primary" />  {t('recommendationscreen.eco_sustainability_metrics')}
                                            </h4>
              <div className="space-y-2.5 text-xs text-gray-700 font-semibold">
                <div className="flex justify-between">
                  <span>{t('recommendationscreen.water_footprint_saved')}</span>
                  <span className="text-primary font-bold">12%</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('recommendationscreen.co_soil_footprint_reduced')}</span>
                  <span className="text-primary font-bold">8%</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('recommendationscreen.organic_humus_density_gain')}</span>
                  <span className="text-primary font-bold">15%</span>
                </div>
                
                <div className="flex justify-between py-1 border-t border-gray-50">
                  <span>{t('recommendationscreen.soil_bio_sustainability_index')}</span>
                  <span className="text-primary font-bold">{t('recommendationscreen.excellent')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('recommendationscreen.chemical_runoff_risk')}</span>
                  <span className="text-emerald-650 font-black">{t('recommendationscreen.low')}</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-150/40 p-3.5 rounded-2xl text-[9px] text-emerald-850 leading-relaxed font-semibold">
                  
                                                    {t('recommendationscreen.custom_mix_uses_organic_compost_bindings')}
                                                  </div>
              </div>
            </div>

          </div>

          {/* SECTION 6 — Horizontal Timeline */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-6 overflow-hidden">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('recommendationscreen.implementation_timeline_roadmap')}</h4>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative pt-2 text-xs">
              <div className="absolute left-[20px] right-[20px] top-[14px] h-0.5 bg-gray-100 -z-10 hidden md:block" />
              
              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">01</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-900">{t('recommendationscreen.today')}</p>
                  <p className="text-[9px] text-gray-450">{t('recommendationscreen.prescription_compiled')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">02</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">{t('recommendationscreen.day_1')}</p>
                  <p className="text-[9px] text-gray-450">{t('recommendationscreen.apply_compost_base')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">03</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">{t('recommendationscreen.day_3')}</p>
                  <p className="text-[9px] text-gray-450">{t('recommendationscreen.ring_apply_npk')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">04</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">{t('recommendationscreen.day_10')}</p>
                  <p className="text-[9px] text-gray-450">{t('recommendationscreen.iot_sensor_audit')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">05</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">{t('recommendationscreen.day_20')}</p>
                  <p className="text-[9px] text-gray-450">{t('recommendationscreen.ndvi_canopy_scan')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-250 text-gray-400 flex items-center justify-center font-bold text-xs shrink-0">06</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-300">{t('recommendationscreen.day_45')}</p>
                  <p className="text-[9px] text-gray-300">{t('recommendationscreen.yield_calibrations')}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Confidence breakdowns, timeline history, Actions list (4/12 width) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* SECTION 9 — AI Confidence Breakdown */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h4 className="text-[10px] font-black text-gray-450 uppercase tracking-widest">{t('recommendationscreen.ai_confidence_matrices')}</h4>
              <span className="text-[10px] font-black text-emerald-650">{t('recommendationscreen.96_overall')}</span>
            </div>

            <div className="space-y-3.5 text-xs text-gray-700 font-semibold">
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.soil_diagnostics_report_data')}</span>
                  <span>98%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "98%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.weather_forecast_telemetry_data')}</span>
                  <span>94%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "94%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.biophysical_digital_twin_simulations')}</span>
                  <span>96%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "96%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.in_situ_iot_telemetry_variables')}</span>
                  <span>91%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "91%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{t('recommendationscreen.regional_crop_yield_datasets')}</span>
                  <span>95%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "95%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 10 — Action Buttons */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs text-left space-y-2.5">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              
                                        {t('recommendationscreen.advisory_actions_suite')}
                                      </h4>
            
            <button
              onClick={() => triggerToast("Recommendation scheduled and synced with agronomist logs.", "success")}
              className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-1.5 border-0 cursor-pointer animate-pulse"
            >
              <ClipboardCheck className="w-4 h-4" />
              
                                        {t('recommendationscreen.accept_recommendation')}
                                      </button>

            <button
              onClick={() => triggerToast("Redirecting to prescription modifier form...", "info")}
              className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              
                                        {t('recommendationscreen.modify_recommendation')}
                                      </button>

            <button
              onClick={() => triggerToast("Synced scheduled fertilization triggers.", "success")}
              className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-primary" />
              
                                        {t('recommendationscreen.schedule_application')}
                                      </button>

            <button
              onClick={() => triggerToast("Generating NPK recommendations PDF report...", "info")}
              className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-primary" />
              
                                        {t('recommendationscreen.download_advisory_pdf')}
                                      </button>
          </div>

          {/* SECTION 11 — Recommendation History */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
            <h4 className="text-[10px] font-black text-gray-450 uppercase tracking-widest border-b border-gray-100 pb-2">
              
                                        {t('recommendationscreen.prescription_history_logs')}
                                      </h4>

            <div className="space-y-4">
              <div className="flex items-start gap-2.5 text-xs text-gray-700 font-semibold leading-relaxed">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <div className="flex-grow space-y-0.5">
                  <p className="text-gray-900 font-bold">{t('recommendationscreen.12_jul_npk_mix_b_broadcast')}</p>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    
                                                          {t('recommendationscreen.status')} <strong className="text-emerald-650 font-extrabold">{t('recommendationscreen.completed')}</strong>  {t('recommendationscreen.result')} <strong>{t('recommendationscreen.9_yield')}</strong>  {t('recommendationscreen.conf_95')}
                                                        </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-gray-700 font-semibold leading-relaxed border-t border-gray-50 pt-3">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <div className="flex-grow space-y-0.5">
                  <p className="text-gray-900 font-bold">{t('recommendationscreen.28_jun_organic_compost_layer')}</p>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    
                                                          {t('recommendationscreen.status')} <strong className="text-emerald-650 font-extrabold">{t('recommendationscreen.completed')}</strong>  {t('recommendationscreen.result')} <strong>{t('recommendationscreen.soil_humus_gain')}</strong>  {t('recommendationscreen.conf_97')}
                                                        </p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </motion.div>
  );
};

// Reusable spinner component to prevent unused imports warning
const RefreshCwSpinner: React.FC = () => {
  return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
};
