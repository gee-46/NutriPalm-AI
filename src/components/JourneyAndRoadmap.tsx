import React from "react";
import { motion } from "framer-motion";
import { 
  Calendar, CloudSun, 
  Orbit, Eye, AlertTriangle, TrendingUp, Cpu, Radio, Plane 
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const JourneyAndRoadmap: React.FC = () => {
  
  // Section 1: Journey Timeline data
  const journeyTimeline = [
    {
      step: "01",
      phase: "Research",
      title: "Soil Chemistry Base",
      description: "Conducted initial agronomic analysis of Arecanut cropping patterns and NPK soil depletion models.",
      date: "Q3 2024"
    },
    {
      step: "02",
      phase: "Farmer Interactions",
      title: "Dakshina Kannada Audits",
      description: "Directly interviewed 50+ regional growers to catalog fertilization schedules and field records.",
      date: "Q4 2024"
    },
    {
      step: "03",
      phase: "Problem Discovery",
      title: "Data Gap Pinpointing",
      description: "Identified core pain points: region-wide generic suggestions and unintelligible chemistry lab sheets.",
      date: "Q1 2025"
    },
    {
      step: "04",
      phase: "Product Planning",
      title: "Digital Twin Specs",
      description: "Defined functional templates for building plot-level digital profiles and NPK recommendation scripts.",
      date: "Q2 2025"
    },
    {
      step: "05",
      phase: "Prototype",
      title: "Vite Console Release",
      description: "Built the interactive digital twin prototype and custom chart telemetry console.",
      date: "Q3 2025"
    },
    {
      step: "06",
      phase: "Incubation",
      title: "Incubation Centre Pitch",
      description: "Presenting the verified software mockup to the Incubation Centre to secure initial seed funding.",
      date: "Present"
    }
  ];

  // Section 2: Future Roadmap data
  const roadmapItems = [
    {
      icon: <Cpu className="w-5 h-5" />,
      title: "AI Agronomist Core",
      desc: "Our neural NPK prescription recommendation models mapping soil cores to fertilizer recipes.",
      status: "completed",
      badgeColor: "bg-green-50 text-green-700 border-green-150"
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Yield Prediction",
      desc: "Calculate harvest weight forecasts based on current NDVI indices and moisture trends.",
      status: "completed",
      badgeColor: "bg-green-50 text-green-700 border-green-150"
    },
    {
      icon: <Orbit className="w-5 h-5" />,
      title: "Satellite Monitoring",
      desc: "Integrate high-revisit multi-spectral satellite telemetry to scan canopy biomass.",
      status: "in-progress",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-150"
    },
    {
      icon: <CloudSun className="w-5 h-5" />,
      title: "Weather Intelligence",
      desc: "Connect local micro-climate forecast nodes to alert growers of frost and heavy rain anomalies.",
      status: "in-progress",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-150"
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: "Computer Vision SCAN",
      desc: "Enable mobile camera scanning of crop leaves to analyze visual chlorophyll health.",
      status: "coming-soon",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Disease Detection",
      desc: "Deploy neural networks trained to scan leaf spotting and rust indices before spreading.",
      status: "coming-soon",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    },
    {
      icon: <Radio className="w-5 h-5" />,
      title: "IoT Soil Sensors",
      desc: "In-field telemetry nodes measuring nitrogen diffusion and volumetric water content real-time.",
      status: "coming-soon",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-150"
    },
    {
      icon: <Plane className="w-5 h-5" />,
      title: "Drone Analytics",
      desc: "Orchestrate automated thermal mapping sweeps for large-scale operations.",
      status: "coming-soon",
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
              eyebrow="The Story"
              title="Our Journey"
              description="Trace the developmental milestone milestones of Samruddhi Organics, mapping agronomic research into software execution."
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
                      Phase {item.step}
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
              eyebrow="The Future"
              title="Future Roadmap"
              description="Our product scaling direction, expanding from core recommendation Twins to full geospatial automated diagnostics."
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
                      {item.status.replace("-", " ")}
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
