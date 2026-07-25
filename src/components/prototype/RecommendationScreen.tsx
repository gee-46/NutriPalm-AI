import React from "react";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  Info, 
  ShieldCheck, 
  AlertTriangle, 
  Bot, 
  BarChart3, 
  Leaf 
} from "lucide-react";

interface RecommendationScreenProps {
  onLoad?: () => void;
}

export const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ onLoad }) => {
  React.useEffect(() => {
    if (onLoad) onLoad();
  }, [onLoad]);
  const scheduleItems = [
    {
      phase: "Phase 1: Pre-Monsoon Basal Enrichment",
      month: "June (Pre-monsoon)",
      details: "Apply 1.8 kg of Custom Mix-B slow-release formulation. Focuses on root absorption during initial rain cycles.",
      method: "Ring Soil Broadcast",
      status: "Scheduled"
    },
    {
      phase: "Phase 2: Active Mid-Cycle Foliar Spray",
      month: "September (Monsoon Break)",
      details: "Apply liquid micro-nutrient spray (Boron + Zinc) to crowns to bypass soil binding during heavy downpours.",
      method: "Crown Foliar Spray",
      status: "Scheduled"
    },
    {
      phase: "Phase 3: Post-Monsoon Fruiting Finish",
      month: "November (Post-monsoon)",
      details: "Apply 1.8 kg of pure High-K (Potassium Chloride) to optimize sugar transport and maximize OER fruit weight.",
      method: "Basal Broadcast",
      status: "Scheduled"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 text-left"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            AI Agronomy Prescription Advisor
          </h1>
          <p className="text-sm text-gray-500 mt-1">Custom slow-release NPK formulations calibrated from soil scans & NDVI maps</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold bg-white border border-gray-250 px-4 py-2.5 rounded-xl shadow-xs text-gray-650">
          <Sparkles className="w-4 h-4 text-amber-500 fill-amber-100" />
          <span>Calibrated: 96.8% Confidence Score</span>
        </div>
      </div>

      {/* Main recommendation layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main slow-release NPK prescription card */}
          <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
            {/* Glowing gradient backdrops */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50/40 rounded-full filter blur-3xl pointer-events-none" />
            
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                    slow-release formulation
                  </span>
                  <h3 className="text-lg font-black text-gray-900 mt-3.5">Samruddhi Organics Mix-B Formula</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-gray-400 block uppercase">CALCULATED ANNUAL DOSAGE</span>
                  <span className="text-primary font-black text-lg">4.8 kg / tree</span>
                </div>
              </div>

              {/* Holographic NPK block */}
              <div className="grid grid-cols-3 gap-4 bg-gray-50/50 border border-gray-150 rounded-2xl p-5 text-center">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Nitrogen (N)</span>
                  <span className="text-2xl font-black text-gray-800 block">12%</span>
                  <span className="text-[9px] text-amber-600 font-semibold block">Moderate deficit top-up</span>
                </div>
                <div className="space-y-1 border-x border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Phosphorus (P)</span>
                  <span className="text-2xl font-black text-gray-800 block">6%</span>
                  <span className="text-[9px] text-emerald-600 font-semibold block">Standard maintenance</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Potassium (K)</span>
                  <span className="text-2xl font-black text-[#2E7D32] block">22%</span>
                  <span className="text-[9px] text-rose-600 font-extrabold block">Critical depletion boost</span>
                </div>
              </div>

              {/* Extra micronutrients text */}
              <div className="flex gap-2 items-center text-xs text-gray-600">
                <Leaf className="w-4.5 h-4.5 text-primary shrink-0" />
                <p>
                  Enriched with <strong>0.5% Boron (B)</strong> and <strong>1.2% Zinc (Zn)</strong> trace compounds to resolve crown leaf folding.
                </p>
              </div>
            </div>

            {/* Sustainability index */}
            <div className="mt-6 pt-5 border-t border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-450 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4.5 h-4.5 text-primary" />
                Eco-Health Sustainability Score
              </span>
              <span className="font-black text-[#2E7D32] bg-emerald-50 border border-emerald-100/50 px-3 py-1 rounded-lg">
                9.4 / 10 (Bio-organic Carrier)
              </span>
            </div>
          </motion.div>

          {/* Timeline schedule */}
          <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-6">
              <Calendar className="w-4 h-4 text-primary" /> Multi-Phase Application Schedule
            </h4>

            <div className="relative pl-6 border-l border-gray-150 space-y-6">
              {scheduleItems.map((item, idx) => (
                <div key={idx} className="relative">
                  {/* Stepper Dot */}
                  <span className="absolute -left-[30px] top-1.5 w-2 h-2 rounded-full bg-primary border-2 border-white shadow-xs" />
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div>
                      <h5 className="text-xs font-black text-gray-800">{item.phase}</h5>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">{item.month} • Method: {item.method}</p>
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{item.details}</p>
                    </div>
                    <span className="bg-emerald-50 text-primary border border-emerald-100/50 text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          
          {/* Expected Yield Boost */}
          <motion.div variants={itemVariants} className="bg-linear-to-tr from-[#1B4D22] to-[#2E7D32] text-white rounded-3xl p-6 shadow-md relative overflow-hidden text-left flex flex-col justify-between min-h-[220px]">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full filter blur-2xl pointer-events-none" />
            
            <div className="space-y-3 relative z-10">
              <span className="text-[9px] font-bold text-emerald-250 uppercase tracking-widest flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Projected Output Gain
              </span>
              <h3 className="text-lg font-extrabold leading-tight">Expected Fruit Bunch Yield</h3>
              
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-4xl font-black tracking-tight">+18.2%</span>
                <span className="text-xs text-emerald-200">Oil Extraction Rate (OER)</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-[10px] text-emerald-100 leading-normal mt-4">
              <strong>ROI projection:</strong> Slow-release nitrogen and potassium enrichment reduces nutrient locking, boosting kernel oil synthesis to yield an estimated 2.8x investment return.
            </div>
          </motion.div>

          {/* AI Reasoning & Deficiencies */}
          <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4 flex items-center gap-1">
              <BarChart3 className="w-4 h-4 text-primary" /> AI Diagnosis & Soil Deficiencies
            </h4>
            
            <div className="space-y-4 text-xs text-gray-650">
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-800">Potassium (K) Deficit</span>
                  <span className="text-rose-600">-120 mg/kg (Critical)</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Low potassium restricts water translocation, producing leaf margin necrosis on lower crowns.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-gray-50 pt-3">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-800">Nitrogen (N) Deficit</span>
                  <span className="text-amber-600">-45 mg/kg (Moderate)</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Nitrogen shortage limits vegetative leaf crown density and overall NDVI vegetation index scores.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-gray-50 pt-3">
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Soil Binding Factor</span>
                  <span>High (Acid pH 5.85)</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Root absorption efficiency is high, making crown foliar micro-dosing highly effective for Boron and Zinc compounds.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Risk indicators */}
          <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Agronomic Risk Factors
            </h4>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">Nitrogen Leaching Risk</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Moderate</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">Fungal Canopy Risk</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Low</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">Moisture Stress Level</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Low</span>
              </div>
            </div>

            {/* Warning banner */}
            <div className="mt-4 flex gap-2 items-start bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 text-[10px] text-indigo-800">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p className="leading-normal font-semibold">
                Slow-release organic carrier prevents nitrogen fertilizer run-off during heavy monsoon downpours.
              </p>
            </div>
          </motion.div>

        </div>

      </div>
    </motion.div>
  );
};
