import React from "react";
import { motion } from "framer-motion";
import { UserCheck, MapPin, Layers, Pipette, Cpu, BarChart2 } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const Features: React.FC = () => {
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
            title="Unified AgriTech Infrastructure"
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
                  Core CRM
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                Farmer Management
              </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                Onboard farm operators, tracking acreage limits, historical regional yield outputs, and profile contracts in a streamlined system.
              </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-3 flex items-center justify-between shadow-sm">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs">RK</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">Rajesh Kumar</span>
                    <span className="text-[9px] text-gray-400">4 Plots • Dakshina Kannada</span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-150">Active</span>
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
                  GeoSpatial
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                Plot Mapping
              </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                Trace exact plot boundaries utilizing high-precision mobile GPS inputs. Automatically calculate acreage slope and shading.
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
                <span className="absolute bottom-1 right-2 text-[9px] font-bold text-sky-850 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">5.4 Acres</span>
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
                  Chemistry
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                Soil Intelligence
              </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                Digitize chemical soil cores to track precise NPK ratios, pH, electrical conductivity, and organic carbon health indices.
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
                  Virtual Simulation
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                Digital Twin
              </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6 max-w-xl">
                A continuous, layered virtual replica mapping NDVI vegetation index, soil moisture cycles, topography slopes, and thermal telemetry, allowing growers to simulate weather anomaly tolerances.
              </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-indigo-150 bg-indigo-50/20 text-indigo-700 flex flex-col justify-between">
                  <span className="text-[9px] font-bold uppercase">Moisture Scan</span>
                  <span className="text-sm font-black mt-1">84% Saturation</span>
                </div>
                <div className="p-3 rounded-xl border border-green-150 bg-green-50/20 text-green-700 flex flex-col justify-between">
                  <span className="text-[9px] font-bold uppercase">NDVI Biomass</span>
                  <span className="text-sm font-black mt-1">0.72 Index</span>
                </div>
                <div className="p-3 rounded-xl border border-gray-200 bg-white text-gray-600 flex flex-col justify-between">
                  <span className="text-[9px] font-bold uppercase">Topography</span>
                  <span className="text-sm font-black mt-1">320m Altitude</span>
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
                  Telemetry Hub
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                Analytics Dashboard
              </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6">
                Track historical yield progress curves, regional rainfall telemetry, crop development states, and budget allocations in real-time.
              </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-3 flex flex-col justify-between h-20">
                <div className="flex justify-between text-[9px] font-bold text-gray-400">
                  <span>YIELD PROGRESS</span>
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
                  Prescription Engine
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors">
                AI Recommendation Engine
              </h3>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6 max-w-xl">
                Run deep agricultural neural networks to generate dynamic fertilizer targets, soil enrichment recipes, and custom crop rotation warnings, reducing mineral waste and maximizing outputs.
              </p>
            </div>

            {/* Apple-style UI Preview */}
            <div className="w-full mt-auto pt-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl border border-gray-150 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left flex flex-col">
                  <span className="text-[9px] font-bold text-gray-450 uppercase">Prescribed Action</span>
                  <span className="text-xs font-black text-gray-800 mt-0.5">Apply NPK 19-19-19 target: 45kg/acre</span>
                </div>
                <button className="px-4 py-2 bg-[#2E7D32] hover:bg-[#235F26] text-white text-[10px] font-bold rounded-xl transition-all shadow-md flex-shrink-0">
                  Apply Prescription
                </button>
              </div>
            </div>
          </motion.div>

        </motion.div>

      </div>
    </section>
  );
};
