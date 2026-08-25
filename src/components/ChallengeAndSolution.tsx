import { useTranslation } from "../translation/useTranslation";
import React from "react";
import { motion } from "framer-motion";
import { 
  AlertTriangle, FileText, FolderSync, BrainCircuit, 
  User, MapPin, Layers, FlaskConical, Cpu, CheckCircle 
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export const ChallengeAndSolution: React.FC = () => {
    const { t } = useTranslation();
  const problems = [
    {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      title: t('challenge.problem1_title'),
      description: t('challenge.problem1_desc'),
      badge: t('challenge.problem1_badge')
    },
    {
      icon: <FileText className="w-5 h-5 text-[#2E7D32]" />,
      title: t('challenge.problem2_title'),
      description: t('challenge.problem2_desc'),
      badge: t('challenge.problem2_badge')
    },
    {
      icon: <FolderSync className="w-5 h-5 text-sky-500" />,
      title: t('challenge.problem3_title'),
      description: t('challenge.problem3_desc'),
      badge: t('challenge.problem3_badge')
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-purple-500" />,
      title: t('challenge.problem4_title'),
      description: t('challenge.problem4_desc'),
      badge: t('challenge.problem4_badge')
    }
  ];

  const solutionFlow = [
    { icon: <User className="w-5 h-5" />, label: t('challenge.flow_farmer'), desc: t('challenge.flow_farmer_desc') },
    { icon: <MapPin className="w-5 h-5" />, label: t('challenge.flow_mapping'), desc: t('challenge.flow_mapping_desc') },
    { icon: <Layers className="w-5 h-5" />, label: t('challenge.flow_twin'), desc: t('challenge.flow_twin_desc') },
    { icon: <FlaskConical className="w-5 h-5" />, label: t('challenge.flow_soil'), desc: t('challenge.flow_soil_desc') },
    { icon: <Cpu className="w-5 h-5" />, label: t('challenge.flow_ai'), desc: t('challenge.flow_ai_desc') },
    { icon: <CheckCircle className="w-5 h-5" />, label: t('challenge.flow_decisions'), desc: t('challenge.flow_decisions_desc') }
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
              eyebrow={t('challenge.eyebrow')}
              title={t('challenge.title')}
              description={t('challenge.desc')}
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
            
                                  {t('challengeandsolution.bridging_the_gap')}
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
              eyebrow={t('about.solution_eyebrow')}
              title={t('challenge.solution_title')}
              description={t('about.solution_p2')}
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
