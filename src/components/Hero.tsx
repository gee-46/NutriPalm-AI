import React from "react";
import { ArrowRight, Play, CheckCircle, Shield, Sparkles, Compass, Sprout, Database } from "lucide-react";
import { motion } from "framer-motion";

export const Hero: React.FC = () => {
  const handleScrollTo = (id: string) => {
    const element = document.querySelector(id);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <section
      id="home"
      className="relative min-h-screen pt-32 pb-20 flex items-center bg-mesh overflow-hidden"
    >
      {/* Background Decorative Blobs */}
      <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#A5D6A7]/20 via-[#66BB6A]/5 to-transparent rounded-full filter blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-gradient-to-tr from-[#2E7D32]/5 to-transparent rounded-full filter blur-3xl pointer-events-none animate-pulse-slow" />

      {/* Topographic Lines Agriculture Backdrop (SVG) */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg
          className="w-full h-full text-primary/10 stroke-current fill-none"
          viewBox="0 0 1440 800"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Alternating Contour Lines representing land levels */}
          <motion.path
            d="M -100 250 C 200 150, 400 350, 800 200 C 1200 50, 1300 450, 1600 300"
            strokeWidth="1.5"
            animate={{
              d: [
                "M -100 250 C 200 150, 400 350, 800 200 C 1200 50, 1300 450, 1600 300",
                "M -100 260 C 210 160, 390 340, 810 210 C 1190 60, 1310 440, 1600 310",
                "M -100 250 C 200 150, 400 350, 800 200 C 1200 50, 1300 450, 1600 300"
              ]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M -100 320 C 200 220, 400 420, 800 270 C 1200 120, 1300 520, 1600 370"
            strokeWidth="1"
            animate={{
              d: [
                "M -100 320 C 200 220, 400 420, 800 270 C 1200 120, 1300 520, 1600 370",
                "M -100 328 C 205 228, 395 412, 805 278 C 1195 128, 1305 512, 1600 378",
                "M -100 320 C 200 220, 400 420, 800 270 C 1200 120, 1300 520, 1600 370"
              ]
            }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M -100 390 C 200 290, 400 490, 800 340 C 1200 190, 1300 590, 1600 440"
            strokeWidth="0.8"
            animate={{
              d: [
                "M -100 390 C 200 290, 400 490, 800 340 C 1200 190, 1300 590, 1600 440",
                "M -100 395 C 202 295, 398 485, 802 345 C 1198 195, 1302 585, 1600 445",
                "M -100 390 C 200 290, 400 490, 800 340 C 1200 190, 1300 590, 1600 440"
              ]
            }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary/10"
            style={{
              top: `${Math.random() * 70 + 15}%`,
              left: `${Math.random() * 80 + 10}%`,
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.08, 0.4, 0.08],
              scale: [0.9, 1.1, 0.9]
            }}
            transition={{
              duration: 8 + Math.random() * 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10 w-full">
        
        {/* Left Side Content */}
        <div className="lg:col-span-6 flex flex-col items-start text-left">
          
          {/* Eyebrow Branding Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-[#2E7D32] bg-[#2E7D32]/10 border border-[#2E7D32]/15 mb-8 shadow-sm shadow-[#2E7D32]/5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as any }}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>NUTRIPALM AI BY SAMRUDDHI ORGANICS</span>
          </motion.div>

          {/* Heading - Refactored typography */}
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.08] mb-6"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] as any }}
          >
            The Digital Agronomist <br />
            for <span className="text-gradient">Precision</span> <br />
            Agriculture
          </motion.h1>

          {/* Subheadline - Clearer value proposition under 5 seconds */}
          <motion.p
            className="text-base md:text-lg text-gray-600 max-w-xl mb-8 leading-relaxed font-normal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] as any }}
          >
            Translating complex biological soil chemistry reports into real-time digital twin models and precision NPK crop prescriptions.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-12"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] as any }}
          >
            <button
              onClick={() => handleScrollTo("#dashboard")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white bg-primary hover:bg-[#235F26] active:scale-95 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200"
            >
              Explore Prototype
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleScrollTo("#workflow")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-250 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-gray-600 text-gray-600" />
              Watch Workflow
            </button>
          </motion.div>

          {/* Realistic Product Pillars instead of generic SaaS metrics */}
          <motion.div
            className="pt-8 border-t border-gray-200/60 w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-[#2E7D32]">
                <Compass className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Soil Twins</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-normal">Interactive virtual field chemistry layer mapping.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-[#2E7D32]">
                <Sprout className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">NPK Recipes</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-normal">Precision mineral recipes preventing nitrogen burn.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-[#2E7D32]">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Yield Telemetry</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-normal">NDVI biomass metrics and harvest estimations.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side Mockup */}
        <div className="lg:col-span-6 flex justify-center relative">
          <motion.div
            className="relative w-full max-w-lg"
            initial={{ opacity: 0, scale: 0.9, rotateY: 5 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] as any }}
          >
            {/* Ambient Background Aura */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#2E7D32]/10 to-[#66BB6A]/10 rounded-[32px] filter blur-xl opacity-70" />

            {/* Main Floating Mockup Container */}
            <motion.div
              className="relative rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xl shadow-gray-900/10 overflow-hidden"
              animate={{ y: [-6, 6] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            >
              {/* Header Ribbon */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-[10px] font-medium text-gray-400 ml-2">nutripalm-twin-v1.2</span>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700">
                  ● Real-Time
                </div>
              </div>

              {/* Digital Twin Graphic Area */}
              <div className="relative rounded-xl bg-gray-50 border border-gray-150 p-4 mb-4 h-48 flex items-center justify-center overflow-hidden">
                {/* Simulated Farm Map Overlay */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#2E7D32_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* 3D-like Farmland Outline (SVG) */}
                <svg className="w-full h-full text-primary" viewBox="0 0 200 120" fill="none">
                  {/* Grid Lines */}
                  <line x1="20" y1="20" x2="180" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
                  <line x1="180" y1="20" x2="20" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
                  
                  {/* Plot shapes */}
                  <motion.polygon
                    points="30,80 80,40 160,50 120,100"
                    fill="rgba(46, 125, 50, 0.08)"
                    stroke="rgba(46, 125, 50, 0.7)"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                  />

                  {/* Hotspots / Indicators */}
                  <circle cx="80" cy="40" r="3" fill="#2E7D32" />
                  <circle cx="120" cy="100" r="3" fill="#2E7D32" />
                  
                  <motion.circle
                    cx="100"
                    cy="65"
                    r="4"
                    fill="#E53E3E"
                    animate={{ scale: [1, 1.6, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                  <text x="110" y="68" fill="#E53E3E" fontSize="8" fontWeight="bold">Soil pH Anomaly</text>
                </svg>

                {/* Plot Health Banner */}
                <div className="absolute bottom-3 left-3 px-4 py-2 rounded-lg bg-white/95 backdrop-blur shadow-sm border border-gray-100 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-[10px] font-bold text-gray-700">Digital Twin Synchronized</span>
                </div>
              </div>

              {/* Stats Widgets */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Nitrogen Levels</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-gray-800">42 mg/kg</span>
                    <span className="text-[10px] font-bold text-green-600">Optimal</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Soil Moisture</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-gray-800">28.4%</span>
                    <span className="text-[10px] font-bold text-amber-500">Irrigate Soon</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Overlapping Floating Sub-Card 1 */}
            <motion.div
              className="absolute -top-6 -left-8 w-44 rounded-xl border border-gray-100 bg-white/90 backdrop-blur p-3.5 shadow-xl hidden sm:flex items-center gap-3"
              animate={{ y: [4, -4] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            >
              <div className="p-2 rounded-lg bg-[#2E7D32]/10 text-[#2E7D32]">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">NPK Analyzer</span>
                <span className="text-xs font-extrabold text-gray-800">100% Accurate</span>
              </div>
            </motion.div>

            {/* Overlapping Floating Sub-Card 2 */}
            <motion.div
              className="absolute -bottom-4 -right-6 w-48 rounded-xl border border-gray-100 bg-white/90 backdrop-blur p-3.5 shadow-xl hidden sm:flex items-center gap-3"
              animate={{ y: [-4, 4] }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            >
              <div className="flex flex-col text-left w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Crop Recommendation</span>
                  <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700">AI</span>
                </div>
                <span className="text-xs font-extrabold text-gray-800">Switch to Millet Rotation</span>
                <div className="w-full bg-gray-100 h-1 rounded-full mt-2 overflow-hidden">
                  <div className="w-11/12 h-full bg-primary" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
