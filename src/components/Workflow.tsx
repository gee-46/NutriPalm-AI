import { useTranslation } from "../translation/useTranslation";
import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  UserPlus, Compass, Layers, FileUp, Cpu, 
  ClipboardCheck, LayoutDashboard 
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const Workflow: React.FC = () => {
    const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll position of the timeline container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });

  // Animate path drawing down the center
  const pathLength = useTransform(scrollYProgress, [0, 0.9], [0, 1]);

  const steps = [
    {
      icon: <UserPlus className="w-5 h-5" />,
      title: "Register Farmer",
      tag: "Step 01",
      description: "Onboard the grower by registering regional coordinate indexes, farm size, and harvest records.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-4 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 border border-green-150 text-green-700 flex items-center justify-center font-bold text-xs">{t('workflow.rk')}</div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-gray-800">{t('workflow.rajesh_kumar')}</span>
              <span className="text-[10px] text-gray-400">{t('workflow.dakshina_kannada_09')}</span>
            </div>
          </div>
          <span className="text-[9px] font-bold text-[#2E7D32] bg-[#2E7D32]/10 border border-[#2E7D32]/20 px-2 py-0.5 rounded-full">{t('workflow.onboarded')}</span>
        </div>
      )
    },
    {
      icon: <Compass className="w-5 h-5" />,
      title: "Create Farm Plot",
      tag: "Step 02",
      description: "Input coordinates or draw boundary lines to map exactly where crops will grow.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-3 w-full h-20 relative overflow-hidden flex items-center justify-center">
          <svg className="w-14 h-14 text-[#2E7D32] drop-shadow-sm" viewBox="0 0 100 100" fill="none">
            <polygon points="10,20 90,15 80,85 20,70" fill="rgba(46, 125, 50, 0.08)" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="10" cy="20" r="3.5" fill="currentColor" />
            <circle cx="90" cy="15" r="3.5" fill="currentColor" />
            <circle cx="80" cy="85" r="3.5" fill="currentColor" />
            <circle cx="20" cy="70" r="3.5" fill="currentColor" />
          </svg>
          <span className="absolute bottom-2 left-2 text-[8px] font-black text-gray-450 uppercase tracking-widest">{t('workflow.plot_coordinate_matrix')}</span>
        </div>
      )
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: "Generate Digital Twin",
      tag: "Step 03",
      description: "Overlay historical moisture models, slope elevations, and NDVI biomass sensors into a virtual replica.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-3 w-full flex flex-col gap-2 justify-center">
          <div className="h-4 rounded bg-indigo-500/10 border border-indigo-150 text-[9px] font-bold text-indigo-700 px-3 flex items-center justify-between">
            <span>{t('workflow.terrain_model')}</span> <span>{t('workflow.320m_slopes')}</span>
          </div>
          <div className="h-4 rounded bg-green-500/10 border border-green-150 text-[9px] font-bold text-green-700 px-3 flex items-center justify-between">
            <span>{t('workflow.ndvi_vegetation')}</span> <span>{t('workflow.0_72_growth')}</span>
          </div>
        </div>
      )
    },
    {
      icon: <FileUp className="w-5 h-5" />,
      title: "Upload Soil Report",
      tag: "Step 04",
      description: "Feed organic soil chemistry values (nitrogen, organic carbon, moisture levels, acidity pH) to our analyzer.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-3 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-primary">
              <FileUp className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-gray-800">{t('workflow.soil_report_rk09_pdf')}</span>
              <span className="text-[9px] text-gray-400">{t('workflow.chemistry_sheet_1_2_mb')}</span>
            </div>
          </div>
          <span className="text-[9px] font-bold text-green-700">{t('workflow.100_uploaded')}</span>
        </div>
      )
    },
    {
      icon: <Cpu className="w-5 h-5" />,
      title: "AI Analysis",
      tag: "Step 05",
      description: "Compare soil metrics against thousands of regional matrices to identify chemical bottlenecks and soil depletion.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-3 w-full h-20 flex items-center justify-center overflow-hidden">
          <svg className="w-full h-12 text-[#2E7D32]" viewBox="0 0 100 40">
            <line x1="10" y1="20" x2="30" y2="10" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="20" x2="30" y2="30" stroke="currentColor" strokeWidth="1" />
            <line x1="30" y1="10" x2="70" y2="10" stroke="currentColor" strokeWidth="1.5" />
            <line x1="30" y1="30" x2="70" y2="30" stroke="currentColor" strokeWidth="1.5" />
            <line x1="70" y1="10" x2="90" y2="20" stroke="currentColor" strokeWidth="1" />
            <line x1="70" y1="30" x2="90" y2="20" stroke="currentColor" strokeWidth="1" />
            <circle cx="10" cy="20" r="3" fill="currentColor" />
            <circle cx="30" cy="10" r="3" fill="currentColor" />
            <circle cx="30" cy="30" r="3" fill="currentColor" />
            <circle cx="70" cy="10" r="3" fill="currentColor" />
            <circle cx="70" cy="30" r="3" fill="currentColor" />
            <circle cx="90" cy="20" r="3" fill="currentColor" />
          </svg>
        </div>
      )
    },
    {
      icon: <ClipboardCheck className="w-5 h-5" />,
      title: "Receive Personalized Recommendation",
      tag: "Step 06",
      description: "Access detailed fertilizer schedules, soil correction steps, and crop rotation advisories tailored for Dakshina Kannada.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-3 w-full flex items-center justify-between">
          <div className="text-left flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase">{t('workflow.personalized_prescription')}</span>
            <span className="text-xs font-bold text-gray-800 mt-0.5">{t('workflow.apply_npk_19_19_19_target_45kg_acre')}</span>
          </div>
          <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-150">{t('workflow.ai_target')}</span>
        </div>
      )
    },
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      title: "Farm Dashboard",
      tag: "Step 07",
      description: "Open the console to monitor real-time weather feeds, NDVI moisture indexes, and upcoming yield alerts.",
      visual: (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-150 p-3 w-full flex flex-col justify-between h-20">
          <div className="flex justify-between text-[9px] font-bold text-gray-400">
            <span>{t('workflow.yield_estimate')}</span>
            <span className="text-green-700">+12%</span>
          </div>
          <svg className="w-full h-8 text-[#2E7D32]" viewBox="0 0 100 40">
            <path d="M 0 35 Q 25 10 50 30 T 100 5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </div>
      )
    }
  ];

  return (
    <section id="workflow" className="py-28 bg-[#F8FAF7] relative overflow-hidden border-t border-gray-100">
      
      {/* Background decorations */}
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#66BB6A]/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Heading */}
        <div className="mb-24 flex justify-center">
          <SectionHeading
            eyebrow="Operational Flow"
            title={t('workflow.how_nutripalm_ai_works')}
            description="Our step-by-step digital process guides growers from registration all the way to precision dashboard analytics."
          />
        </div>

        {/* Timeline Container */}
        <div ref={containerRef} className="relative max-w-4xl mx-auto">
          
          {/* Alternating Winding Connecting SVG Path (Desktop) */}
          <div className="absolute inset-0 pointer-events-none z-0 hidden md:block">
            <svg className="w-full h-full text-gray-200" viewBox="0 0 800 1800" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Main Winding Path */}
              <motion.path
                d="M 400 40 
                   C 400 150, 200 150, 200 240 
                   C 200 350, 600 350, 600 480 
                   C 600 600, 200 600, 200 720 
                   C 200 840, 600 840, 600 960 
                   C 600 1080, 200 1080, 200 1200 
                   C 200 1320, 600 1320, 600 1440 
                   C 600 1550, 400 1550, 400 1660"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="8 8"
              />
              {/* Active path drawing on scroll */}
              <motion.path
                d="M 400 40 
                   C 400 150, 200 150, 200 240 
                   C 200 350, 600 350, 600 480 
                   C 600 600, 200 600, 200 720 
                   C 200 840, 600 840, 600 960 
                   C 600 1080, 200 1080, 200 1200 
                   C 200 1320, 600 1320, 600 1440 
                   C 600 1550, 400 1550, 400 1660"
                stroke="#2E7D32"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ pathLength }}
              />
            </svg>
          </div>

          {/* Timeline Nodes */}
          <div className="flex flex-col gap-24 md:gap-32 relative z-10">
            {steps.map((step, idx) => {
              const isEven = idx % 2 === 0;

              return (
                <div
                  key={idx}
                  className={`flex flex-col md:flex-row items-center md:justify-between w-full relative ${
                    isEven ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Left Side (Text Details) */}
                  <motion.div
                    className="w-full md:w-[42%] text-left"
                    initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as any }}
                  >
                    <div className="glass-card rounded-3xl p-6 md:p-8 bg-white border border-gray-150 relative overflow-hidden group">
                      <span className="text-[10px] font-bold text-[#2E7D32] bg-[#2E7D32]/10 border border-[#2E7D32]/15 px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-4">
                        {step.tag}
                      </span>
                      <h3 className="text-xl font-extrabold text-gray-950 mb-3 group-hover:text-primary transition-colors">
                        {step.title}
                      </h3>
                      <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>

                  {/* Center Node Orb (Desktop) */}
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center z-20">
                    <motion.div
                      className="w-12 h-12 rounded-full border border-gray-200 bg-white shadow-md text-gray-600 flex items-center justify-center"
                      whileInView={{
                        scale: [0.8, 1.1, 1],
                        borderColor: ["#E5E7EB", "#2E7D32"],
                        color: ["#4B5563", "#2E7D32"]
                      }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      {step.icon}
                    </motion.div>
                  </div>

                  {/* Right Side (Visual Illustration Showcase) */}
                  <motion.div
                    className="w-full md:w-[42%] mt-6 md:mt-0 flex justify-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                  >
                    {step.visual}
                  </motion.div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
