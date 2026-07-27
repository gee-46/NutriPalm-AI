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
              <span className="text-xs font-black text-gray-800">Recalibrating agronomical recommendation models...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" />
            AI Crop Recommendation Engine
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            AI-generated precision agriculture recommendations based on soil health, Digital Twin analysis, weather forecasts, and telemetry insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-xs cursor-pointer border-0"
          >
            <Sparkles className="w-4 h-4 text-white fill-white/20 animate-pulse" />
            Generate New Recommendation
          </button>
          
          <button
            onClick={() => triggerToast("Compiling PDF advisory report...", "info")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            Export PDF
          </button>

          <button
            onClick={() => triggerToast("Copied advisory token to clipboard.", "success")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-gray-500" />
            Share Report
          </button>
        </div>
      </div>

      {/* ================= SECTION 1 — Farm Summary ================= */}
      <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4 text-xs font-semibold text-gray-700">
        <div className="space-y-1">
          <span className="block text-[8px] text-gray-400 uppercase">Farmer</span>
          <span className="text-gray-900 font-black block">S. Gowda</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Farm Plot</span>
          <span className="text-gray-900 font-black block">Plot 2A</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Crop Type</span>
          <span className="text-primary font-black block">🌴 Oil Palm</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Area</span>
          <span className="text-gray-900 font-black block">12.5 Acres</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Growth Phase</span>
          <span className="text-gray-900 font-black block">Fruit Dev</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Last Soil Scan</span>
          <span className="text-emerald-650 font-black block flex items-center gap-1">✓ Complete</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Weather Index</span>
          <span className="text-emerald-650 font-black block flex items-center gap-1">🟢 Storm Alert: None</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Digital Twin</span>
          <span className="text-emerald-650 font-black block flex items-center gap-1">🟢 Calibrated</span>
        </div>
        <div className="space-y-1 border-l border-gray-100 pl-3">
          <span className="block text-[8px] text-gray-400 uppercase">Overall Health</span>
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
                    slow-release organic carrier
                  </span>
                  <h3 className="text-xl font-black text-gray-900 mt-4">NPK 20:10:10 + Organic Compost</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-gray-400 block uppercase">Priority level</span>
                  <span className="text-rose-600 font-black text-sm bg-rose-50 border border-rose-100 px-3 py-1 rounded-xl">HIGH</span>
                </div>
              </div>

              {/* Progress counter fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Confidence Score</span>
                  <span className="text-xl font-black text-gray-950 mt-1 block">
                    <AnimatedCounter value={96} suffix="%" />
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Yield Increase</span>
                  <span className="text-xl font-black text-primary mt-1 block">
                    <AnimatedCounter value={18} suffix="%" />
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Soil Improvement</span>
                  <span className="text-xl font-black text-primary mt-1 block">
                    <AnimatedCounter value={12} suffix="%" />
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Application Window</span>
                  <span className="text-sm font-black text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg mt-2.5 inline-block">Within 5 Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3 — Dosage Plan */}
          <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-gray-100">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Advisory Dosage Specification</h4>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-150 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="p-4 pl-6">Fertilizer Component</th>
                    <th className="p-4">Quantity / Acre</th>
                    <th className="p-4">Application Method</th>
                    <th className="p-4">Frequency</th>
                    <th className="p-4 pr-6">Optimal Timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-semibold">
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-950">NPK 20:10:10</td>
                    <td className="p-4 text-gray-800">50 kg / acre</td>
                    <td className="p-4">Soil Broadcast (Ring)</td>
                    <td className="p-4">Once</td>
                    <td className="p-4 text-primary font-bold pr-6">Morning Hours (Pre-noon)</td>
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-950">Organic Compost</td>
                    <td className="p-4 text-gray-800">250 kg / acre</td>
                    <td className="p-4">Manual Root Zone Mounding</td>
                    <td className="p-4">Once</td>
                    <td className="p-4 text-primary font-bold pr-6">Week 1 (Basal base)</td>
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-extrabold text-gray-950">Micronutrient Spray</td>
                    <td className="p-4 text-gray-800">2 L / acre</td>
                    <td className="p-4">Foliar Canopy Misting</td>
                    <td className="p-4">Every 14 Days</td>
                    <td className="p-4 text-primary font-bold pr-6">Late Evening (Pre-sunset)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4 — Why AI Generated This (AI Reasoning) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-left">Model Explainability Reasoning</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Reason 1 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0"><AlertTriangle className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">Low Nitrogen Detected</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">98% Conf.</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    Current soil nitrogen levels are below the optimal vegetative threshold of 180 ppm, causing leaf yellowing.
                  </p>
                </div>
              </div>

              {/* Reason 2 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0"><AlertTriangle className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">Low Organic Carbon</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">94% Conf.</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    Organic matter density index is low, restricting soil retention of inorganic fertilizer nutrients.
                  </p>
                </div>
              </div>

              {/* Reason 3 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-blue-50 text-blue-500 rounded-xl shrink-0"><CloudRain className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">Rain Forecast Absorption</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">89% Conf.</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    Precipitation indices forecast rain in 48h, facilitating rapid dissolution and absorption of Urea.
                  </p>
                </div>
              </div>

              {/* Reason 4 */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl flex gap-3 items-start shadow-xs">
                <span className="p-2 bg-emerald-50 text-primary rounded-xl shrink-0"><Bot className="w-5 h-5" /></span>
                <div className="space-y-1">
                  <div className="flex justify-between items-center w-full">
                    <h5 className="font-extrabold text-xs text-gray-900">Digital Twin Prediction</h5>
                    <span className="text-[9px] font-bold text-gray-450 bg-gray-100 px-1.5 py-0.2 rounded-md">96% Conf.</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                    Canopy simulation models predict fruit bundle size boost after 14-day vegetative nitrogen boost.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 5 — Expected Improvements Comparisons */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-6">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Projected Improvement Forecasts</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Yield comparison */}
              <div className="space-y-3.5 border-r border-gray-100 pr-5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-extrabold text-gray-800">Fruit Bunch Yield</span>
                  <span className="text-xs font-black text-primary bg-emerald-50 px-2 py-0.5 rounded-full">+18.2% Gain</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-gray-400 uppercase">Current Yield</span>
                    <span className="text-base font-black text-gray-700">3.8 Tons/ha</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-250/20 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-primary uppercase">Predicted Yield</span>
                    <span className="text-base font-black text-primary">4.5 Tons/ha</span>
                  </div>
                </div>
              </div>

              {/* Soil Health comparison */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-extrabold text-gray-800">Soil Health Score</span>
                  <span className="text-xs font-black text-primary bg-emerald-50 px-2 py-0.5 rounded-full">+12.0% Gain</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-gray-400 uppercase">Current Soil</span>
                    <span className="text-base font-black text-gray-700">76% Vigor</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-250/20 p-2.5 rounded-xl">
                    <span className="block text-[8px] text-primary uppercase">Predicted Soil</span>
                    <span className="text-base font-black text-primary">88% Vigor</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Extra Progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-gray-100 text-xs">
              <div className="space-y-1 font-semibold">
                <div className="flex justify-between font-bold">
                  <span>Water Usage Reduction</span>
                  <span className="text-primary">-12% Saved</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "12%" }} />
                </div>
              </div>
              <div className="space-y-1 font-semibold">
                <div className="flex justify-between font-bold">
                  <span>Fertilizer Absorption Efficiency</span>
                  <span className="text-primary">+15% Gain</span>
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
                <DollarSign className="w-4 h-4 text-primary" /> Cost-Benefit Valuation
              </h4>
              <div className="space-y-2.5 text-xs text-gray-700 font-semibold">
                <div className="flex justify-between">
                  <span>Estimated Fertilizer Cost</span>
                  <span className="text-gray-900">$185</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Labor Cost</span>
                  <span className="text-gray-900">$40</span>
                </div>
                <div className="flex justify-between py-1 border-t border-gray-50 font-bold">
                  <span>Total Capital Outlay</span>
                  <span className="text-gray-950 font-black">$225</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Expected Gross Revenue Increase</span>
                  <span className="text-primary font-black">+$540</span>
                </div>
                
                {/* ROI Badge */}
                <div className="bg-emerald-50 border border-emerald-150/40 p-3 rounded-2xl flex justify-between items-center text-xs mt-2">
                  <span className="font-extrabold text-emerald-850">Estimated ROI Rate</span>
                  <span className="text-lg font-black text-primary">140% ROI</span>
                </div>

                <div className="flex justify-between text-[10px] pt-1 text-gray-400 font-black uppercase">
                  <span>Break-even Period: 28 Days</span>
                  <span>Confidence: 96%</span>
                </div>
              </div>
            </div>

            {/* Environmental Impact card */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs text-left space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-primary" /> Eco-sustainability Metrics
              </h4>
              <div className="space-y-2.5 text-xs text-gray-700 font-semibold">
                <div className="flex justify-between">
                  <span>Water Footprint Saved</span>
                  <span className="text-primary font-bold">12%</span>
                </div>
                <div className="flex justify-between">
                  <span>CO₂ Soil Footprint Reduced</span>
                  <span className="text-primary font-bold">8%</span>
                </div>
                <div className="flex justify-between">
                  <span>Organic Humus Density Gain</span>
                  <span className="text-primary font-bold">15%</span>
                </div>
                
                <div className="flex justify-between py-1 border-t border-gray-50">
                  <span>Soil Bio-Sustainability Index</span>
                  <span className="text-primary font-bold">Excellent</span>
                </div>
                <div className="flex justify-between">
                  <span>Chemical Runoff Risk</span>
                  <span className="text-emerald-650 font-black">Low</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-150/40 p-3.5 rounded-2xl text-[9px] text-emerald-850 leading-relaxed font-semibold">
                  Custom mix uses organic compost bindings that anchor chemical nutrients to soil structures, reducing groundwater leaching risk by 96%.
                </div>
              </div>
            </div>

          </div>

          {/* SECTION 6 — Horizontal Timeline */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-6 overflow-hidden">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Implementation Timeline Roadmap</h4>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative pt-2 text-xs">
              <div className="absolute left-[20px] right-[20px] top-[14px] h-0.5 bg-gray-100 -z-10 hidden md:block" />
              
              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">01</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-900">Today</p>
                  <p className="text-[9px] text-gray-450">Prescription Compiled</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">02</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">Day 1</p>
                  <p className="text-[9px] text-gray-450">Apply Compost Base</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">03</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">Day 3</p>
                  <p className="text-[9px] text-gray-450">Ring Apply NPK</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">04</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">Day 10</p>
                  <p className="text-[9px] text-gray-450">IoT Sensor Audit</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-primary text-primary flex items-center justify-center font-bold text-xs shrink-0">05</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-950">Day 20</p>
                  <p className="text-[9px] text-gray-450">NDVI Canopy Scan</p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:gap-0 md:text-center">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-250 text-gray-400 flex items-center justify-center font-bold text-xs shrink-0">06</div>
                <div className="md:mt-2 text-left md:text-center">
                  <p className="font-extrabold text-gray-300">Day 45</p>
                  <p className="text-[9px] text-gray-300">Yield Calibrations</p>
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
              <h4 className="text-[10px] font-black text-gray-450 uppercase tracking-widest">AI Confidence Matrices</h4>
              <span className="text-[10px] font-black text-emerald-650">96% Overall</span>
            </div>

            <div className="space-y-3.5 text-xs text-gray-700 font-semibold">
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Soil Diagnostics Report data</span>
                  <span>98%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "98%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Weather Forecast Telemetry data</span>
                  <span>94%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "94%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Biophysical Digital Twin simulations</span>
                  <span>96%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "96%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>In-situ IoT Telemetry variables</span>
                  <span>91%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "91%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Regional Crop yield datasets</span>
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
              Advisory Actions Suite
            </h4>
            
            <button
              onClick={() => triggerToast("Recommendation scheduled and synced with agronomist logs.", "success")}
              className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-1.5 border-0 cursor-pointer animate-pulse"
            >
              <ClipboardCheck className="w-4 h-4" />
              Accept Recommendation
            </button>

            <button
              onClick={() => triggerToast("Redirecting to prescription modifier form...", "info")}
              className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Modify Recommendation
            </button>

            <button
              onClick={() => triggerToast("Synced scheduled fertilization triggers.", "success")}
              className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-primary" />
              Schedule Application
            </button>

            <button
              onClick={() => triggerToast("Generating NPK recommendations PDF report...", "info")}
              className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-primary" />
              Download Advisory PDF
            </button>
          </div>

          {/* SECTION 11 — Recommendation History */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
            <h4 className="text-[10px] font-black text-gray-450 uppercase tracking-widest border-b border-gray-100 pb-2">
              Prescription History Logs
            </h4>

            <div className="space-y-4">
              <div className="flex items-start gap-2.5 text-xs text-gray-700 font-semibold leading-relaxed">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <div className="flex-grow space-y-0.5">
                  <p className="text-gray-900 font-bold">12 Jul: NPK Mix-B Broadcast</p>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    Status: <strong className="text-emerald-650 font-extrabold">Completed</strong> • Result: <strong>+9% Yield</strong> • Conf. 95%
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-gray-700 font-semibold leading-relaxed border-t border-gray-50 pt-3">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <div className="flex-grow space-y-0.5">
                  <p className="text-gray-900 font-bold">28 Jun: Organic Compost Layer</p>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    Status: <strong className="text-emerald-650 font-extrabold">Completed</strong> • Result: <strong>Soil humus gain</strong> • Conf. 97%
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
