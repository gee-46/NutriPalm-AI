import React, { useRef, useState, useEffect } from "react";
import { ShieldCheck, ArrowRight, HelpCircle, EyeOff, LayoutGrid, BarChart3 } from "lucide-react";
import { motion, useInView } from "framer-motion";

const teamMembers = [
  {
    id: "sathwik",
    name: "Sathwik Krishna",
    role: "Founder & CEO",
    imgSrc: "/sathwik-krishna.jpg",
    initials: "SK",
    imgPos: "object-[center_20%]",
    desc: "Founder & CEO of Samruddhi Organics, leading the company's vision of transforming agriculture through innovation, sustainability, and technology. Spearheading the development of NutriPalm AI to empower farmers with intelligent digital solutions and data-driven decision-making."
  },
  {
    id: "dhanush",
    name: "Dhanush",
    role: "Managing Partner",
    imgSrc: "/suhan.png",
    initials: "D",
    imgPos: "object-[center_16%]",
    desc: "Oversees strategic operations, business growth initiatives, and organizational planning while supporting the execution of NutriPalm AI's vision."
  },
  {
    id: "suhan",
    name: "Suhan",
    role: "Managing Partner",
    imgSrc: "/dhanush.png",
    initials: "S",
    imgPos: "object-[center_12%]",
    desc: "Leads strategic partnerships, operational coordination, and cross-functional collaboration to drive the growth and successful implementation of NutriPalm AI."
  },
  {
    id: "samruddhi-pai",
    name: "Samruddhi Pai",
    role: "Marketing Head",
    imgSrc: "/samruddhi-pai.png",
    initials: "SP",
    imgPos: "object-[center_18%]",
    desc: "Leads the marketing initiatives for NutriPalm AI, focusing on brand strategy, campaign planning, community outreach, and creating impactful communication that connects innovation with the agricultural community."
  },
  {
    id: "nihal",
    name: "Nihal P K",
    role: "Marketing Head",
    imgSrc: "/nihal.jpg",
    initials: "NP",
    imgPos: "object-[center_18%]",
    desc: "Drives marketing strategy and brand engagement for NutriPalm AI by planning campaigns, strengthening outreach initiatives, and promoting the platform's vision to farmers, partners, and the wider AgriTech ecosystem."
  },
  {
    id: "bhumika",
    name: "Bhumika Rao",
    role: "Marketing Head",
    imgSrc: "/bhumika.jpg",
    initials: "BR",
    imgPos: "object-[center_18%]",
    desc: "Leads brand communication and marketing initiatives for NutriPalm AI, focusing on creative campaigns, community engagement, digital outreach, and strengthening the platform's presence across the AgriTech ecosystem."
  },
  {
    id: "karthik",
    name: "Karthik H V",
    role: "Social Media Marketing",
    imgSrc: "/karthik.jpg",
    initials: "KH",
    imgPos: "object-[center_18%]",
    desc: "Leads NutriPalm AI's social media presence by creating engaging content, managing digital campaigns, strengthening community engagement, and increasing the platform's visibility across social media channels."
  },
  {
    id: "gautam",
    name: "Gautam N Chipkar",
    role: "Technical Lead – AI & Platform Engineering",
    imgSrc: "/gautam.png",
    initials: "GC",
    imgPos: "object-[center_40%]",
    desc: "Leads the AI strategy, system architecture, and technical development of NutriPalm AI. Responsible for designing the platform, integrating Digital Twin concepts, developing intelligent workflows, and building scalable AI-powered solutions that enable data-driven precision agriculture."
  }
];

export const About: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.35 });
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        setHasEntered(true);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [isInView]);

  const milestones = [
    {
      emoji: "🌱",
      title: "Supported 50+ Farmers",
      description: "Directly onboarded and guided growers across Dakshina Kannada, tailoring practices to their specific local environments."
    },
    {
      emoji: "🧪",
      title: "Delivered Soil-Test Recommendations",
      description: "Built fertilizer plans grounded in laboratory chemistry analysis rather than regional guesswork."
    },
    {
      emoji: "🌴",
      title: "Precision Nutrient Recipes",
      description: "Developed custom arecanut and crop nutrition recipes, balancing fertilizer applications and boosting yields."
    },
    {
      emoji: "📍",
      title: "Soil Intelligence Leadership",
      description: "Amassed deep field expertise in soil chemistry dynamics, water absorption capacities, and micro-nutrient profiles."
    }
  ];

  const transitionSteps = [
    { label: "Samruddhi Organics", desc: "Sustainable Ag Initative" },
    { label: "Farmer Interactions", desc: "Understanding field bottlenecks" },
    { label: "Real Ag Problems", desc: "Chemical clutters & raw reports" },
    { label: "Scientific Research", desc: "Soil mapping & custom recipes" },
    { label: "NutriPalm AI", desc: "Platform concept creation" },
    { label: "Digital Agronomist", desc: "AI-powered Digital Twin" }
  ];

  const timelineSteps = [
    { phase: "Research", detail: "Agronomy analysis" },
    { phase: "Farmer Feedback", detail: "Dakshina Kannada pilots" },
    { phase: "Product Vision", detail: "Precision templates" },
    { phase: "Digital Twin Concept", detail: "Layered farm maps" },
    { phase: "Prototype", detail: "Vite/React twin builder" },
    { phase: "Incubation Centre", detail: "Pitch validation" },
    { phase: "Pilot Deployment", detail: "Grower release" }
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
                alt="Samruddhi Organics Logo"
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
              Venture Overview
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-tight mb-6">
              About Samruddhi Organics
            </h2>
            
            <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-6 font-normal">
              Samruddhi Organics is an AgriTech startup focused on improving farm productivity through scientific soil analysis, customized nutrient recommendations, precision agriculture, and sustainable farming practices.
            </p>

            <p className="text-base md:text-lg text-gray-600 leading-relaxed font-normal">
              Our mission is to make data-driven agriculture simple, affordable, and accessible for every farmer.
            </p>
          </motion.div>

        </div>

        {/* SECTION 2: OUR JOURNEY */}
        <div className="mb-28">
          <div className="text-center mb-16">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-3">Milestones</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Our Journey So Far</h3>
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
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-3">Leadership</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Our Leadership Team</h3>
          </div>

          {/* Infinite Horizontal Marquee Carousel */}
          <div className="w-full overflow-hidden relative py-6 mask-gradient">
            <div className={`flex gap-8 w-max py-4 ${hasEntered ? "animate-marquee hover:[animation-play-state:paused]" : ""}`}>
              
              {/* First Set of Cards */}
              {teamMembers.map((member, idx) => (
                <motion.div
                  key={`${member.id}-first`}
                  className="glass-card rounded-[28px] p-8 bg-white border border-gray-150 flex flex-col items-center justify-between text-center hover:-translate-y-1.5 hover:shadow-lg hover:border-primary/20 transition-all duration-300 relative group overflow-hidden w-[340px] sm:w-[340px] w-[290px] h-[400px] shrink-0"
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

              {/* Second Set of Cards for Seamless Infinite Loop */}
              {teamMembers.map((member) => (
                <div
                  key={`${member.id}-second`}
                  className="glass-card rounded-[28px] p-8 bg-white border border-gray-150 flex flex-col items-center justify-between text-center hover:-translate-y-1.5 hover:shadow-lg hover:border-primary/20 transition-all duration-300 relative group overflow-hidden w-[340px] sm:w-[340px] w-[290px] h-[400px] shrink-0"
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
                </div>
              ))}
              
            </div>
          </div>
        </div>

        {/* SECTION 3: SECTION TRANSITION */}
        <div className="mb-28">
          <div className="text-center mb-12">
            <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-widest block mb-2">Evolution Path</span>
            <h3 className="text-2xl font-extrabold text-gray-950 tracking-tight">From Experience to Innovation</h3>
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
            <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-[0.16em] mb-4">The Solution Engine</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-950 tracking-tight leading-tight mb-6">
              Why NutriPalm AI?
            </h2>
            
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-6 font-normal">
              While working directly with farmers, Samruddhi Organics observed recurring agricultural bottlenecks that hindered productivity.
            </p>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed font-normal mb-8">
              These direct insights inspired the creation of **NutriPalm AI**—an AI-powered Digital Agronomist that creates a Digital Twin for every farm plot and delivers personalized recommendations.
            </p>

            <div className="p-4 rounded-xl border border-green-150/40 bg-gradient-to-r from-green-50/50 to-green-100/10 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#2E7D32] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#2E7D32] font-semibold leading-relaxed">
                By building a digital profile for each field, we ensure that science-backed decision support is accessible to every grower.
              </p>
            </div>
          </motion.div>

          {/* Right Column: Challenges Grid */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <HelpCircle className="w-5 h-5 text-amber-500 mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">Generic Recommendations</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">Standard regional fertilizer calculations fail to address specific plot micro-climates.</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <EyeOff className="w-5 h-5 text-[#2E7D32] mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">Unclear Soil Reports</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">Laboratory PDF reports present raw values and chemistry jargon without actionable guides.</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <LayoutGrid className="w-5 h-5 text-sky-500 mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">No Digital Records</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">Critical logs of historical crop rotations and fertilizer inputs are lost or scattered.</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-150 bg-white">
              <BarChart3 className="w-5 h-5 text-purple-500 mb-4" />
              <h4 className="text-sm font-bold text-gray-900 mb-2">Static Decision Support</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">Growers operate blindly without real-time tracking, moisture charts, or agronomic feedback loops.</p>
            </div>
          </div>

        </div>

        {/* SECTION 5: VISUAL TIMELINE */}
        <div className="mb-28">
          <div className="text-center mb-16">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-3">Milestone Progress</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Visual Timeline</h3>
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
          <span className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-[0.16em] block mb-4">The Impact Goal</span>
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 mb-4">
            Transforming Agriculture Through Intelligence
          </h3>
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-8 max-w-xl mx-auto">
            Ready to explore how NutriPalm AI scales these customized nutrient frameworks into real-time digital agricultural profiles?
          </p>
          <button
            onClick={() => handleScrollTo("#dashboard")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-[#235F26] active:scale-95 shadow-md shadow-primary/10 transition-all duration-200"
          >
            Explore NutriPalm AI Prototype
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

      </div>
    </section>
  );
};
