import { useTranslation } from "../translation/useTranslation";
import React, { useRef } from "react";
import { ShieldCheck, ArrowRight, HelpCircle, EyeOff, LayoutGrid, BarChart3 } from "lucide-react";
import { motion, useInView } from "framer-motion";



export const About: React.FC = () => {
  const { t } = useTranslation();
  
  const teamMembers = [
    {
      id: "sathwik",
      name: "Sathwik Krishna",
      role: t('about.roles.Founder & CEO'),
      imgSrc: "/sathwik-krishna.jpg",
      initials: "SK",
      imgPos: "object-[center_20%]",
      desc: t('about.team.sathwik')
    },
    {
      id: "dhanush",
      name: "Dhanush",
      role: t('about.roles.Managing Partner'),
      imgSrc: "/suhan.png",
      initials: "D",
      imgPos: "object-[center_16%]",
      desc: t('about.team.dhanush')
    },
    {
      id: "suhan",
      name: "Suhan",
      role: t('about.roles.Managing Partner'),
      imgSrc: "/dhanush.png",
      initials: "S",
      imgPos: "object-[center_12%]",
      desc: t('about.team.suhan')
    }
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.35 });

  const milestones = [
    {
      emoji: "🌱",
      title: t('about.ms1_title'),
      description: t('about.ms1_desc')
    },
    {
      emoji: "🧪",
      title: t('about.ms2_title'),
      description: t('about.ms2_desc')
    },
    {
      emoji: "🌴",
      title: t('about.ms3_title'),
      description: t('about.ms3_desc')
    },
    {
      emoji: "📍",
      title: t('about.ms4_title'),
      description: t('about.ms4_desc')
    }
  ];

  const transitionSteps = [
    { label: t('about.evolution.0.label'), desc: t('about.evolution.0.desc') },
    { label: t('about.evolution.1.label'), desc: t('about.evolution.1.desc') },
    { label: t('about.evolution.2.label'), desc: t('about.evolution.2.desc') },
    { label: t('about.evolution.3.label'), desc: t('about.evolution.3.desc') },
    { label: t('about.evolution.4.label'), desc: t('about.evolution.4.desc') },
    { label: t('about.evolution.5.label'), desc: t('about.evolution.5.desc') }
  ];

  const timelineSteps = [
    { phase: t('about.timeline.0.phase'), detail: t('about.timeline.0.detail') },
    { phase: t('about.timeline.1.phase'), detail: t('about.timeline.1.detail') },
    { phase: t('about.timeline.2.phase'), detail: t('about.timeline.2.detail') },
    { phase: t('about.timeline.3.phase'), detail: t('about.timeline.3.detail') },
    { phase: t('about.timeline.4.phase'), detail: t('about.timeline.4.detail') },
    { phase: t('about.timeline.5.phase'), detail: t('about.timeline.5.detail') },
    { phase: t('about.timeline.6.phase'), detail: t('about.timeline.6.detail') }
  ];

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
    <section id="about" className="py-28 bg-[#F8FAF7] relative overflow-hidden border-t border-gray-100">
      
      {/* Background contour line decoration */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none">
        <svg className="w-full h-full text-primary" viewBox="0 0 1440 800" fill="none">
          <path d="M0 100 Q400 150 700 80 T1440 120" stroke="currentColor" strokeWidth="2" />
          <path d="M0 250 Q300 200 800 280 T1440 220" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 400 Q500 450 900 350 T1440 380" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* SECTION 1: ABOUT SAMRUDDHI ORGANICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mb-28">
          
          {/* Left Side: Premium Brand Card */}
          <motion.div
            className="lg:col-span-5 flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }}
          >
            {/* Elevated Brand Card */}
            <motion.div
              className="w-full max-w-[240px] aspect-square rounded-[24px] bg-black shadow-2xl flex items-center justify-center p-2 overflow-hidden border border-gray-800"
              animate={{ y: [-5, 5] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
            >
              <img 
                src="/samruddhi-logo.jpeg" 
                alt={t('about.samruddhi_organics_logo')}
                className="w-full h-full object-contain"
              />
            </motion.div>
          </motion.div>

          {/* Right Side: Showcase Content */}
          <motion.div
            className="lg:col-span-7 text-left flex flex-col items-start justify-center"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] as any }}
          >
            <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-[0.16em] mb-4">
              
                                        {t('about.venture_overview')}
                                      </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-tight mb-6">
              
                                        {t('about.about_samruddhi_organics')}
                                      </h2>
            
            <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-6 font-normal">
              
                                        {t('about.samruddhi_organics_is_an_agritech_startu')}
                                      </p>

            <p className="text-base md:text-lg text-gray-600 leading-relaxed font-normal">
              
                                        {t('about.our_mission_is_to_make_data_driven_agric')}
                                      </p>
          </motion.div>

        </div>

        {/* SECTION 2: OUR JOURNEY */}
        <div className="mb-28">
          <div className="text-center mb-16">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-3">{t('about.milestones')}</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">{t('about.our_journey_so_far')}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
            {milestones.map((item, idx) => (
              <motion.div
                key={idx}
                className="glass-card rounded-2xl p-6 bg-white border border-gray-150 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 relative group overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
                <div>
                  <span className="text-3xl block mb-6">{item.emoji}</span>
                  <h4 className="text-base font-extrabold text-gray-950 mb-3 group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mt-auto">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* SECTION: LEADERSHIP TEAM */}
        <div ref={containerRef} className="mb-28 w-full overflow-hidden relative">
          <div className="text-center mb-16">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-3">{t('about.leadership')}</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">{t('about.our_leadership_team')}</h3>
          </div>

          {/* Stable and Frozen Grid */}
          <div className="w-full py-6 flex justify-center px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl justify-center items-center">
              {teamMembers.map((member, idx) => (
                <motion.div
                  key={member.id}
                  className="glass-card rounded-[28px] p-8 bg-white border border-gray-150 flex flex-col items-center justify-between text-center hover:-translate-y-1.5 hover:shadow-lg hover:border-primary/20 transition-all duration-300 relative group overflow-hidden w-[290px] sm:w-[340px] h-[400px] shrink-0"
                  initial={{ opacity: 0, y: 60, scale: 0.95 }}
                  animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 60, scale: 0.95 }}
                  transition={{ duration: 0.75, delay: idx * 0.2, ease: "easeOut" }}
                >
                  {/* Glow border highlight */}
                  <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-primary to-secondary opacity-70" />
                  
                  {/* Circular Avatar */}
                  <div className="relative mb-4 w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 shadow-md flex items-center justify-center bg-gray-100 z-10 shrink-0">
                    <img
                      src={member.imgSrc}
                      alt={member.name}
                      className={`w-full h-full object-cover ${member.imgPos} transition-transform duration-500 group-hover:scale-105 z-10 relative`}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    {/* Fallback Initials */}
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 text-[#2E7D32] font-black text-2xl z-0">
                      {member.initials}
                    </div>
                  </div>

                  <div className="flex-grow flex flex-col justify-center">
                    {/* Role */}
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                      {member.role}
                    </span>

                    {/* Name */}
                    <h4 className="text-base font-extrabold text-gray-950 mb-2 group-hover:text-primary transition-colors leading-tight">
                      {member.name}
                    </h4>

                    {/* Description */}
                    <p className="text-[11.5px] text-gray-500 leading-normal max-w-[280px]">
                      {member.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: SECTION TRANSITION */}
        <div className="mb-28">
          <div className="text-center mb-12">
            <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-widest block mb-2">{t('about.evolution_path')}</span>
            <h3 className="text-2xl font-extrabold text-gray-950 tracking-tight">{t('about.from_experience_to_innovation')}</h3>
          </div>

          {/* Connect Diagram */}
          <div className="relative max-w-5xl mx-auto py-8">
            {/* Connection path (Desktop) */}
            <div className="absolute top-1/2 left-8 right-8 h-[1px] bg-gray-200 transform -translate-y-6 hidden lg:block z-0" />

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-6 relative z-10">
              {transitionSteps.map((step, idx) => (
                <motion.div
                  key={idx}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-150 shadow-sm flex items-center justify-center text-primary font-bold text-sm mb-3">
                    {idx + 1}
                  </div>
                  <span className="text-xs font-extrabold text-gray-950 text-center tracking-tight mb-1">
                    {step.label}
                  </span>
                  <span className="text-[10px] text-gray-400 text-center leading-tight max-w-[120px]">
                    {step.desc}
                  </span>
                  {idx < transitionSteps.length - 1 && (
                    <div className="h-6 w-0.5 bg-gray-200 my-3 block lg:hidden" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: INTRODUCE NUTRIPALM AI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mb-28 text-left">
          
          {/* Left Column: Why NutriPalm AI */}
          <motion.div
            className="lg:col-span-6 flex flex-col items-start justify-center"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }}
          >
            <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-[0.16em] mb-4">{t('about.the_solution_engine')}</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-tight mb-6">
              
                                        {t('about.why_nutripalm_ai')}
                                      </h2>
            
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-6 font-normal">
              
                                        {t('about.while_working_directly_with_farmers_samr')}
                                      </p>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed font-normal mb-8">
              
                                        {t('about.these_direct_insights_inspired_the_creat')}
                                      </p>

            <div className="p-4 rounded-xl border border-green-150/40 bg-gradient-to-r from-green-50/50 to-green-100/10 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#2E7D32] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#2E7D32] font-semibold leading-relaxed">
                
                                              {t('about.by_building_a_digital_profile_for_each_f')}
                                            </p>
            </div>
          </motion.div>

          {/* Right Column: Challenges Grid */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <HelpCircle className="w-5 h-5 text-amber-500 mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">{t('about.generic_recommendations')}</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">{t('about.standard_regional_fertilizer_calculation')}</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <EyeOff className="w-5 h-5 text-[#2E7D32] mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">{t('about.unclear_soil_reports')}</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">{t('about.laboratory_pdf_reports_present_raw_value')}</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <LayoutGrid className="w-5 h-5 text-sky-500 mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">{t('about.no_digital_records')}</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">{t('about.critical_logs_of_historical_crop_rotatio')}</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <BarChart3 className="w-5 h-5 text-purple-500 mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">{t('about.static_decision_support')}</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">{t('about.growers_operate_blindly_without_real_tim')}</p>
            </div>
          </div>

        </div>

        {/* SECTION 5: VISUAL TIMELINE */}
        <div className="mb-28">
          <div className="text-center mb-16">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-3">{t('about.milestone_progress')}</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">{t('about.visual_timeline')}</h3>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* Connecting Timeline Line (Desktop) */}
            <div className="absolute top-1/2 left-8 right-8 h-[1px] bg-gray-200 transform -translate-y-5 hidden lg:block z-0" />

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-6 relative z-10">
              {timelineSteps.map((node, idx) => (
                <motion.div
                  key={idx}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                >
                  <div className="w-10 h-10 rounded-full border border-gray-150 bg-white shadow-sm flex items-center justify-center text-xs font-bold text-[#2E7D32] mb-3">
                    {idx + 1}
                  </div>
                  <span className="text-xs font-bold text-gray-950 text-center tracking-tight mb-1">
                    {node.phase}
                  </span>
                  <span className="text-[9px] text-gray-400 text-center leading-normal max-w-[100px]">
                    {node.detail}
                  </span>
                  {idx < timelineSteps.length - 1 && (
                    <div className="h-6 w-0.5 bg-gray-200 my-2 block lg:hidden" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 6: SECTION SIGN OFF */}
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-[0.16em] block mb-4">{t('about.the_impact_goal')}</span>
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 mb-4">
            
                                  {t('about.transforming_agriculture_through_intelli')}
                                </h3>
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-8 max-w-xl mx-auto">
            
                                  {t('about.ready_to_explore_how_nutripalm_ai_scales')}
                                </p>
          <button
            onClick={() => handleScrollTo("#dashboard")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-[#235F26] active:scale-95 shadow-md shadow-primary/10 transition-all duration-200"
          >
            
                                  {t('about.explore_nutripalm_ai_prototype')}
                                  <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

      </div>
    </section>
  );
};
