import { useTranslation } from "../translation/useTranslation";
import React, { useState } from "react";
import { ArrowUpRight } from "lucide-react";

interface CTAProps {
  onExplore?: () => void;
}

export const CTA: React.FC<CTAProps> = ({ onExplore }) => {
    const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(false);
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
    <section id="cta" className="relative overflow-hidden bg-[#F5EFDF] pt-12 md:pt-20">
      <div className="relative z-10">
        
        {/* Main CTA Panel */}
        <div
          className="bg-primary rounded-t-[50%_6rem] px-8 pt-24 pb-24 md:pt-32 md:pb-28 text-center relative overflow-hidden"
        >
          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            
            {/* Small Tag */}
            <span className="text-[10px] font-bold text-[#CDD6BD] uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/15 mb-6">
              
                                        {t('cta.get_incubation_access')}
                                      </span>

            {/* Headline */}
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6">
              
                                        {t('cta.ready_to_transform')} <br className="hidden sm:inline" />
              
                                        {t('cta.agriculture')}
                                      </h2>

            {/* Subtext */}
            <p className="text-sm md:text-base text-[#CDD6BD] leading-relaxed mb-8 max-w-lg">
              
                                        {t('cta.explore_the_digital_twin_prototype_of_nu')}
                                      </p>

            {/* Button */}
            <button
              onClick={async () => {
                if (onExplore && !isInitializing) {
                  setIsInitializing(true);
                  await new Promise((resolve) => setTimeout(resolve, 600));
                  onExplore();
                } else if (!onExplore) {
                  handleScrollTo("#dashboard");
                }
              }}
              disabled={isInitializing}
              className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all duration-300 cursor-pointer ${
                isInitializing
                  ? "bg-white text-[#142820] shadow-[#CDD6BD]/50 scale-[0.98]"
                  : "text-[#142820] bg-[#CDD6BD] hover:bg-white active:scale-95 shadow-lg shadow-black/10 hover:shadow-[#CDD6BD]/25"
              }`}
            >
              {isInitializing ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#142820] border-t-transparent rounded-full animate-spin shrink-0" />
                  
                                                    {t('cta.initializing_nutripalm_ai')}
                                                  </>
              ) : (
                <>
                  
                                                        {t('cta.explore_prototype')}
                                                        <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
