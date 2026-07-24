import React from "react";
import { Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";

export const Footer: React.FC = () => {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
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
    <footer id="contact" className="bg-[#F8FAF7] border-t border-gray-200/60 pt-20 pb-10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-gray-200/60 text-left">
          {/* Brand Info Column */}
          <div className="md:col-span-4 flex flex-col items-start">
            <a href="#home" onClick={(e) => handleScrollTo(e, "#home")} className="flex items-center gap-3 mb-6 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 100 100" fill="none">
                  <path d="M50 75 Q50 50 50 35" stroke="white" strokeWidth="8" strokeLinecap="round" />
                  <path d="M50 55 C40 50 35 40 48 30" stroke="white" strokeWidth="6" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-base font-bold text-gray-900">
                NutriPalm <span className="text-primary">AI</span>
              </span>
            </a>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              Building the future of intelligent organic agriculture by combining precision soil analytics with digital twin simulation models.
            </p>
            <span className="text-[10px] font-bold text-[#2E7D32] uppercase tracking-wider">
              A Samruddhi Organics Initiative
            </span>
          </div>

          {/* Quick Links Column */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-6">
              Platform Suite
            </h4>
            <div className="flex flex-col gap-3">
              <a href="#home" onClick={(e) => handleScrollTo(e, "#home")} className="text-xs text-gray-500 hover:text-primary transition-colors">Home</a>
              <a href="#about" onClick={(e) => handleScrollTo(e, "#about")} className="text-xs text-gray-500 hover:text-primary transition-colors">About Mission</a>
              <a href="#features" onClick={(e) => handleScrollTo(e, "#features")} className="text-xs text-gray-500 hover:text-primary transition-colors">Core Features</a>
              <a href="#workflow" onClick={(e) => handleScrollTo(e, "#workflow")} className="text-xs text-gray-500 hover:text-primary transition-colors">Usage Workflow</a>
            </div>
          </div>

          {/* Incubation Links Column */}
          <div className="md:col-span-2" id="roadmap">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-6">
              Company
            </h4>
            <div className="flex flex-col gap-3">
              <span className="text-xs text-gray-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                Roadmap <ArrowUpRight className="w-3 h-3 text-gray-400" />
              </span>
              <span className="text-xs text-gray-500 hover:text-primary transition-colors cursor-pointer">Soil Lab Network</span>
              <span className="text-xs text-gray-500 hover:text-primary transition-colors cursor-pointer">Privacy Charter</span>
              <span className="text-xs text-gray-500 hover:text-primary transition-colors cursor-pointer">Support Desk</span>
            </div>
          </div>

          {/* Contact Details Column */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-6">
              Contact Incubator
            </h4>
            <div className="flex flex-col gap-4 text-xs text-gray-500">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>contact@samruddhiorganics.com</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 text-left" />
                <span>Samruddhi Organics HQ,<br />Agronomy Innovation Park, Pune</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom Row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-gray-400">
            © {new Date().getFullYear()} Samruddhi Organics. All rights reserved. NutriPalm AI and all virtual assets are proprietary prototypes.
          </p>
          <div className="flex gap-6 text-[10px] text-gray-400">
            <span className="hover:text-primary cursor-pointer">Terms of Service</span>
            <span className="hover:text-primary cursor-pointer">Cookie Policy</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
