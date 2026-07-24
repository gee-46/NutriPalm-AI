import React from "react";
import { motion } from "framer-motion";
import { 
  AlertTriangle, FileText, FolderSync, BrainCircuit, 
  User, MapPin, Layers, FlaskConical, Cpu, CheckCircle 
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const ChallengeAndSolution: React.FC = () => {
  const problems = [
    {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      title: "Generic Fertilizer Recommendations",
      description: "Region-wide guidelines that ignore plot-specific soil conditions, leading to nutrient imbalances and wasted capital.",
      badge: "Vague Input"
    },
    {
      icon: <FileText className="w-5 h-5 text-[#2E7D32]" />,
      title: "Difficult Soil Reports",
      description: "Complex laboratory reports filled with raw chemical values and abbreviations that are impossible for growers to decipher.",
      badge: "Raw Chemistry"
    },
    {
      icon: <FolderSync className="w-5 h-5 text-sky-500" />,
      title: "No Digital Farm History",
      description: "Vital field logs, historic yields, and previous NPK inputs are scattered across papers or completely forgotten.",
      badge: "Zero Records"
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-purple-500" />,
      title: "Decisions Without Data",
      description: "Growers manage water levels and fertilizer applications based on intuition rather than empirical agronomic metrics.",
      badge: "Blind Farming"
    }
  ];

  const solutionFlow = [
    { icon: <User className="w-5 h-5" />, label: "Farmer", desc: "Grower profile onboarding" },
    { icon: <MapPin className="w-5 h-5" />, label: "Farm Mapping", desc: "GPS boundaries defined" },
    { icon: <Layers className="w-5 h-5" />, label: "Digital Twin", desc: "Virtual replica mapped" },
    { icon: <FlaskConical className="w-5 h-5" />, label: "Soil Intelligence", desc: "Chemical data uploaded" },
    { icon: <Cpu className="w-5 h-5" />, label: "AI Recommendation", desc: "Target NPK recipes" },
    { icon: <CheckCircle className="w-5 h-5" />, label: "Smarter Decisions", desc: "Optimal yield actions" }
  ];

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as any } 
    }
  };

  return (
    <div className="relative">
      
      {/* ================= SECTION 1: THE CHALLENGE ================= */}
      <section id="problem" className="py-24 bg-[#F8FAF7] relative overflow-hidden border-t border-gray-100">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="mb-20 flex justify-center">
            <SectionHeading
              eyebrow="The Bottleneck"
              title="The Challenge in Modern Agriculture"
              description="Farming currently operates with critical information gaps, making it difficult to make precise agronomic choices."
            />
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {problems.map((prob, idx) => (
              <motion.div
                key={idx}
                variants={cardVariants}
                className="glass-card rounded-2xl p-8 flex flex-col text-left hover:scale-[1.01] transition-transform duration-300 group relative overflow-hidden bg-white"
              >
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gray-100 group-hover:bg-[#2E7D32]/50 transition-colors duration-300" />
                
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-xl bg-[#F8FAF7] border border-gray-150 group-hover:bg-[#2E7D32]/5 transition-colors duration-300">
                    {prob.icon}
                  </div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                    {prob.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-950 mb-3 group-hover:text-primary transition-colors">
                  {prob.title}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                  {prob.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* ================= STORYTELLING PIPELINE BRIDGE ================= */}
      <div className="py-12 bg-white flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAF7] to-white pointer-events-none" />
        
        {/* Animated Connecting Bridge */}
        <motion.div
          className="flex flex-col items-center gap-3 relative z-10"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-10 w-[1.5px] bg-gradient-to-b from-red-400 to-[#2E7D32]" />
          <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-[0.2em] bg-[#2E7D32]/5 border border-[#2E7D32]/10 px-3 py-1 rounded-full">
            Bridging The Gap
          </span>
          <div className="h-10 w-[1.5px] bg-[#2E7D32]" />
        </motion.div>
      </div>

      {/* ================= SECTION 2: OUR SOLUTION ================= */}
      <section id="solution" className="py-24 bg-white relative overflow-hidden">
        {/* Soft Background Highlight */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#66BB6A]/5 rounded-full filter blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="mb-20 flex justify-center">
            <SectionHeading
              eyebrow="The Innovation"
              title="Our Solution"
              description="NutriPalm AI exists to convert soil reports into live digital twins, delivering precise crop-nutrition guidelines straight to the farmer."
            />
          </div>

          {/* Solution Flow Visualizer */}
          <div className="relative">
            {/* Horizontal Line on Desktop */}
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-100 transform -translate-y-12 hidden lg:block z-0 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#2E7D32] via-[#66BB6A] to-[#A5D6A7]"
                initial={{ x: "-100%" }}
                whileInView={{ x: "0%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
              />
            </div>

            {/* Nodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 relative z-10">
              {solutionFlow.map((step, idx) => (
                <motion.div
                  key={idx}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] as any }}
                >
                  {/* Circle Orb */}
                  <div className="relative mb-6 group cursor-pointer">
                    <div className="absolute -inset-2 bg-[#2E7D32]/10 rounded-2xl filter blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-green-50 to-green-100/50 border border-green-150 flex items-center justify-center text-[#2E7D32] shadow-sm group-hover:scale-105 transition-transform duration-300">
                      {step.icon}
                    </div>

                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-[9px] font-extrabold text-gray-500 flex items-center justify-center shadow-sm">
                      {idx + 1}
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="text-center px-1">
                    <h4 className="text-xs font-bold text-gray-900 mb-1">{step.label}</h4>
                    <p className="text-[10px] text-gray-500 leading-normal max-w-[120px] mx-auto">{step.desc}</p>
                  </div>

                  {/* Vertical Line on Mobile */}
                  {idx < solutionFlow.length - 1 && (
                    <div className="h-6 w-0.5 bg-gray-100 my-3 block lg:hidden" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
