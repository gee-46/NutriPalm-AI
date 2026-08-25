import { useTranslation } from "../translation/useTranslation";
import React from "react";
import { motion } from "framer-motion";
import { 
  Calendar, CloudSun, 
  Orbit, Eye, AlertTriangle, TrendingUp, Cpu, Radio, Plane 
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const JourneyAndRoadmap: React.FC = () => {
    const { t } = useTranslation();
  
  // Section 1: Journey Timeline data
  const journeyTimeline = [
    {
      step: "01",
      phase: t('journey.p1_phase'),
      title: t('journey.p1_title'),
      description: t('journey.p1_desc'),
      date: "Q3 2024"
    },
    {
      step: "02",
      phase: t('journey.p2_phase'),
      title: t('journey.p2_title'),
      description: t('journey.p2_desc'),
      date: "Q4 2024"
    },
    {
      step: "03",
      phase: t('journey.p3_phase'),
      title: t('journey.p3_title'),
      description: t('journey.p3_desc'),
      date: "Q1 2025"
    },
    {
      step: "04",
      phase: t('journey.p4_phase'),
      title: t('journey.p4_title'),
      description: t('journey.p4_desc'),
      date: "Q2 2025"
    },
    {
      step: "05",
      phase: t('journey.p5_phase'),
      title: t('journey.p5_title'),
      description: t('journey.p5_desc'),
      date: "Q3 2025"
    },
    {
      step: "06",
      phase: t('journey.p6_phase'),
      title: t('journey.p6_title'),
      description: t('journey.p6_desc'),
      date: "Present"
    }
  ];

  // Section 2: Future Roadmap data
  const roadmapItems = [
    {
      icon: <Cpu className="w-5 h-5" />,
      title: t('roadmap.r1_title'),
      desc: t('roadmap.r1_desc'),
      statusLabel: t('roadmap.completed'),
      badgeColor: "bg-green-50 text-green-700 border-green-150"
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: t('roadmap.r2_title'),
      desc: t('roadmap.r2_desc'),
      statusLabel: t('roadmap.completed'),
      badgeColor: "bg-green-50 text-green-700 border-green-150"
    },
    {
      icon: <Orbit className="w-5 h-5" />,
      title: t('roadmap.r3_title'),
      desc: t('roadmap.r3_desc'),
      statusLabel: t('roadmap.in_progress'),
      badgeColor: "bg-amber-50 text-amber-700 border-amber-150"
    },
    {
      icon: <CloudSun className="w-5 h-5" />,
      title: t('roadmap.r4_title'),
      desc: t('roadmap.r4_desc'),
      statusLabel: t('roadmap.in_progress'),
      badgeColor: "bg-amber-50 text-amber-700 border-amber-150"
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: t('roadmap.r5_title'),
      desc: t('roadmap.r5_desc'),
      statusLabel: t('roadmap.coming_soon'),
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: t('roadmap.r6_title'),
      desc: t('roadmap.r6_desc'),
      statusLabel: t('roadmap.coming_soon'),
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    },
    {
      icon: <Radio className="w-5 h-5" />,
      title: t('roadmap.r7_title'),
      desc: t('roadmap.r7_desc'),
      statusLabel: t('roadmap.coming_soon'),
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    },
    {
      icon: <Plane className="w-5 h-5" />,
      title: t('roadmap.r8_title'),
      desc: t('roadmap.r8_desc'),
      statusLabel: t('roadmap.coming_soon'),
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    }
  ];

  return (
    <div className="relative">
      
      {/* ================= SECTION 1: OUR JOURNEY ================= */}
      <section id="roadmap" className="py-24 bg-white relative overflow-hidden border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="mb-20 flex justify-center">
            <SectionHeading
              eyebrow={t('journey.eyebrow')}
              title={t('journey.title')}
              description={t('journey.subtitle')}
            />
          </div>

          {/* Timeline Node Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {journeyTimeline.map((item, idx) => (
              <motion.div
                key={idx}
                className="glass-card rounded-2xl p-6 bg-white border border-gray-150 flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[220px]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
              >
                {/* Node Top info */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-extrabold text-[#2E7D32] bg-[#2E7D32]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                      
                                                      {t('journeyandroadmap.phase')} {item.step}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {item.date}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-gray-950 mb-2">{item.title}</h4>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-4">{item.phase}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mt-auto">{item.description}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ================= SECTION 2: FUTURE ROADMAP ================= */}
      <section className="py-24 bg-[#F8FAF7] relative overflow-hidden border-t border-gray-100">
        {/* Soft Background Highlight */}
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#66BB6A]/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="mb-20 flex justify-center">
            <SectionHeading
              eyebrow={t('roadmap.eyebrow')}
              title={t('roadmap.title')}
              description={t('roadmap.subtitle')}
            />
          </div>

          {/* Futuristic Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {roadmapItems.map((item, idx) => (
              <motion.div
                key={idx}
                className="glass-card rounded-2xl p-6 bg-white/70 backdrop-blur-md border border-gray-150 flex flex-col justify-between text-left hover:scale-[1.02] transition-transform duration-300 relative group overflow-hidden min-h-[260px]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
              >
                {/* Glow border highlight */}
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gray-100 group-hover:bg-[#2E7D32]/50 transition-colors duration-300" />
                
                <div>
                  <div className="flex items-center justify-between mb-6">
                    {/* Icon Circle */}
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-[#2E7D32] group-hover:bg-[#2E7D32]/5 transition-colors duration-300">
                      {item.icon}
                    </div>
                    {/* Status Badge */}
                    <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${item.badgeColor}`}>
                      {item.statusLabel}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-extrabold text-gray-950 mb-3">{item.title}</h4>
                </div>

                <p className="text-[11px] text-gray-500 leading-relaxed mt-auto">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
};
