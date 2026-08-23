import { useTranslation } from "../translation/useTranslation";
import React from "react";
import { motion } from "framer-motion";
import { UserCheck, MapPin, Layers, Pipette, Cpu, BarChart2 } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const Features: React.FC = () => {
    const { t } = useTranslation();
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as any }
    }
  };

  return (
    <section id="features" className="py-28 bg-[#F8FAF7] relative overflow-hidden border-t border-gray-100">
      
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#66BB6A]/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Heading */}
        <div className="mb-20 flex justify-center">
          <SectionHeading
            eyebrow="The Console Suite"
            title={t('features.unified_agritech_infrastructure')}
            description="NutriPalm AI bundles six premium modules into a unified bento interface, giving operators complete oversight of their agricultural ecosystem."
          />
        </div>

        {/* Bento Grid Layout */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          
          {/* Card 1: Farmer Management (Standard - 1x) */}
          <motion.div
            variants={cardVariants}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 group bg-white border border-gray-150 relative overflow-hidden min-h-[360px]"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-green-50 border border-green-100 text-[#2E7D32]">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  
                                                    {t('features.core_crm')}
                                                  </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                
                                              {t('features.farmer_management')}
                                            </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                
                                              {t('features.onboard_farm_operators_tracking_acreage_')}
                                            </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-3 flex items-center justify-between shadow-sm">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs">{t('features.rk')}</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">{t('features.rajesh_kumar')}</span>
                    <span className="text-[9px] text-gray-400">{t('features.4_plots_dakshina_kannada')}</span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-150">{t('features.active')}</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Plot Mapping (Standard - 1x) */}
          <motion.div
            variants={cardVariants}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 group bg-white border border-gray-150 relative overflow-hidden min-h-[360px]"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  
                                                    {t('features.geospatial')}
                                                  </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                
                                              {t('features.plot_mapping')}
                                            </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                
                                              {t('features.trace_exact_plot_boundaries_utilizing_hi')}
                                            </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-2 h-20 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=300&auto=format&fit=crop')` }} />
                <svg className="w-14 h-14 text-sky-600 drop-shadow" viewBox="0 0 100 100" fill="none">
                  <polygon points="20,20 80,30 70,80 30,70" fill="rgba(2, 132, 199, 0.1)" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                  <circle cx="20" cy="20" r="3" fill="currentColor" />
                  <circle cx="80" cy="30" r="3" fill="currentColor" />
                  <circle cx="70" cy="80" r="3" fill="currentColor" />
                </svg>
                <span className="absolute bottom-1 right-2 text-[9px] font-bold text-sky-850 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">{t('features.5_4_acres')}</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Soil Intelligence (Standard - 1x) */}
          <motion.div
            variants={cardVariants}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 group bg-white border border-gray-150 relative overflow-hidden min-h-[360px]"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600">
                  <Pipette className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  
                                                    {t('features.chemistry')}
                                                  </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                
                                              {t('features.soil_intelligence')}
                                            </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                
                                              {t('features.digitize_chemical_soil_cores_to_track_pr')}
                                            </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-3 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <span className="text-[10px] font-extrabold text-amber-700">N</span>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1"><div className="w-4/5 h-full bg-amber-500" /></div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-extrabold text-green-700">P</span>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1"><div className="w-1/2 h-full bg-green-500" /></div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-extrabold text-blue-700">K</span>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1"><div className="w-1/4 h-full bg-blue-500" /></div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Digital Twin (Large - 2x width on desktop) */}
          <motion.div
            variants={cardVariants}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 group bg-white border border-gray-150 relative overflow-hidden min-h-[360px] lg:col-span-2"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  
                                                    {t('features.virtual_simulation')}
                                                  </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                
                                              {t('features.digital_twin')}
                                            </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6 max-w-xl">
                
                                              {t('features.a_continuous_layered_virtual_replica_map')}
                                            </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-indigo-150 bg-indigo-50/20 text-indigo-700 flex flex-col justify-between">
                  <span className="text-[9px] font-bold uppercase">{t('features.moisture_scan')}</span>
                  <span className="text-sm font-black mt-1">{t('features.84_saturation')}</span>
                </div>
                <div className="p-3 rounded-xl border border-green-150 bg-green-50/20 text-green-700 flex flex-col justify-between">
                  <span className="text-[9px] font-bold uppercase">{t('features.ndvi_biomass')}</span>
                  <span className="text-sm font-black mt-1">{t('features.0_72_index')}</span>
                </div>
                <div className="p-3 rounded-xl border border-gray-200 bg-white text-gray-600 flex flex-col justify-between">
                  <span className="text-[9px] font-bold uppercase">{t('features.topography')}</span>
                  <span className="text-sm font-black mt-1">{t('features.320m_altitude')}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 5: Analytics Dashboard (Standard - 1x) */}
          <motion.div
            variants={cardVariants}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 group bg-white border border-gray-150 relative overflow-hidden min-h-[360px]"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  
                                                    {t('features.telemetry_hub')}
                                                  </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                
                                              {t('features.analytics_dashboard')}
                                            </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                
                                              {t('features.track_historical_yield_progress_curves_r')}
                                            </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-3 flex flex-col justify-between h-20">
                <div className="flex justify-between text-[9px] font-bold text-gray-400">
                  <span>{t('features.yield_progress')}</span>
                  <span className="text-emerald-600">+12.4%</span>
                </div>
                <svg className="w-full h-8 text-emerald-500" viewBox="0 0 100 40">
                  <path d="M 0 35 Q 15 20 30 25 T 60 10 T 90 5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M 0 35 Q 15 20 30 25 T 60 10 T 90 5 L 100 40 L 0 40 Z" fill="rgba(16, 185, 129, 0.05)" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Card 6: AI Recommendation Engine (Large - 2x width on desktop) */}
          <motion.div
            variants={cardVariants}
            className="glass-card rounded-3xl p-8 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 group bg-white border border-gray-150 relative overflow-hidden min-h-[360px] lg:col-span-2"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600">
                  <Cpu className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  
                                                    {t('features.prescription_engine')}
                                                  </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                
                                              {t('features.ai_recommendation_engine')}
                                            </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6 max-w-xl">
                
                                              {t('features.run_deep_agricultural_neural_networks_to')}
                                            </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left flex flex-col">
                  <span className="text-[9px] font-bold text-gray-450 uppercase">{t('features.prescribed_action')}</span>
                  <span className="text-xs font-black text-gray-800 mt-0.5">{t('features.apply_npk_19_19_19_target_45kg_acre')}</span>
                </div>
                <button className="px-4 py-2 bg-[#2E7D32] hover:bg-[#235F26] text-white text-[10px] font-bold rounded-xl transition-all shadow-md flex-shrink-0">
                  
                                                    {t('features.apply_prescription')}
                                                  </button>
              </div>
            </div>
          </motion.div>

        </motion.div>

      </div>
    </section>
  );
};
