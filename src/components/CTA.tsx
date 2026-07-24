import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

export const CTA: React.FC = () => {
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
    <section className="py-24 bg-white relative overflow-hidden border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Main CTA Panel */}
        <motion.div
          className="bg-premium-green rounded-[32px] px-8 py-16 md:py-24 text-center relative overflow-hidden shadow-2xl shadow-green-950/20"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Subtle Top Radial Lighting Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_60%)] pointer-events-none" />
          
          {/* Wave/Grid decoration in background */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          {/* Interactive Floating Sparkle */}
          <div className="absolute top-10 right-10 opacity-30 animate-pulse-slow">
            <Sparkles className="w-12 h-12 text-white" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            
            {/* Small Tag */}
            <span className="text-[10px] font-bold text-[#A5D6A7] uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/15 mb-6">
              Get Incubation Access
            </span>

            {/* Headline */}
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6">
              Ready to Transform <br className="hidden sm:inline" />
              Agriculture?
            </h2>

            {/* Subtext */}
            <p className="text-sm md:text-base text-[#C3D8C2] leading-relaxed mb-8 max-w-lg">
              Explore the digital twin prototype of NutriPalm AI and see how Samruddhi Organics is merging sustainable agronomy with AI-driven analytics.
            </p>

            {/* Button */}
            <button
              onClick={() => handleScrollTo("#dashboard")}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-[#1B4D22] bg-[#A5D6A7] hover:bg-white active:scale-95 shadow-lg shadow-black/10 hover:shadow-[#A5D6A7]/25 transition-all duration-200"
            >
              Explore Prototype
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

      </div>
    </section>
  );
};
