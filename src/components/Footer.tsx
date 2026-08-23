import { useTranslation } from "../translation/useTranslation";
import React from "react";
import { Mail, Phone, MapPin, Sparkles } from "lucide-react";

interface FooterProps {
  onExplore: () => void;
}

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export const Footer: React.FC<FooterProps> = ({ onExplore }) => {
    const { t } = useTranslation();
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    
    // Find contact or about or other sections
    let href = id;
    if (id === "#technology") href = "#features";
    if (id === "#leadership") href = "#about";
    
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
    <footer className="bg-gray-950 text-gray-400 pt-20 pb-8 relative overflow-hidden">
      {/* Top Border with Green Gradient */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-primary/10 via-primary to-primary/10" />

      {/* Background soft grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#2E7D32 0.75px, transparent 0.75px)",
            backgroundSize: "24px 24px"
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-16 text-left border-b border-gray-900">
          
          {/* Column 1: Brand Info */}
          <div className="lg:col-span-4 flex flex-col items-start">
            <a href="#home" onClick={(e) => handleScrollTo(e, "#home")} className="flex items-center gap-3 mb-6 group">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/20 shadow-sm shrink-0 bg-white">
                <img
                  src="/samruddhi-logo.jpeg"
                  alt={t('footer.samruddhi_organics_logo')}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white transition-colors group-hover:text-primary">
                
                                              {t('footer.nutripalm')} <span className="text-primary font-black">{t('footer.ai')}</span>
              </span>
            </a>
            
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider mb-3">
              <Sparkles className="w-2.5 h-2.5" />
              
                                        {t('footer.incubated_startup')}
                                      </span>
            
            <p className="text-xs font-bold text-gray-300 mb-4 leading-normal">
              
                                        {t('footer.an_ai_powered_precision_agriculture_plat')}
                                      </p>
            
            <p className="text-2xs md:text-xs text-gray-500 leading-relaxed mb-6 font-normal">
              
                                        {t('footer.empowering_farmers_with_artificial_intel')}
                                      </p>

            {/* Social Icons */}
            <div className="flex gap-4">
              <a 
                href="https://www.linkedin.com/company/samruddhiorganic/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('footer.linkedin_profile')}
                className="p-2.5 bg-gray-900 hover:bg-primary hover:text-white rounded-xl text-gray-400 transition-all duration-300 hover:-translate-y-0.5"
              >
                <LinkedInIcon className="w-4 h-4" />
              </a>
              <a 
                href="mailto:samruddhiorganics24@gmail.com"
                aria-label={t('footer.send_email')}
                className="p-2.5 bg-gray-900 hover:bg-primary hover:text-white rounded-xl text-gray-400 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a 
                href="tel:+919663541622"
                aria-label={t('footer.call_office')}
                className="p-2.5 bg-gray-900 hover:bg-primary hover:text-white rounded-xl text-gray-400 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6">
              
                                        {t('footer.quick_links')}
                                      </h4>
            <nav className="flex flex-col gap-3">
              <a href="#home" onClick={(e) => handleScrollTo(e, "#home")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.home')}</a>
              <a href="#about" onClick={(e) => handleScrollTo(e, "#about")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.about')}</a>
              <a href="#features" onClick={(e) => handleScrollTo(e, "#features")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.features')}</a>
              <a href="#workflow" onClick={(e) => handleScrollTo(e, "#workflow")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.workflow')}</a>
              <a href="#technology" onClick={(e) => handleScrollTo(e, "#technology")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.technology')}</a>
              <a href="#leadership" onClick={(e) => handleScrollTo(e, "#leadership")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.leadership')}</a>
              <a href="#contact" onClick={(e) => handleScrollTo(e, "#contact")} className="text-xs text-gray-450 hover:text-primary transition-colors cursor-pointer">{t('footer.contact')}</a>
            </nav>
          </div>

          {/* Column 3: Prototype Navigation */}
          <div className="lg:col-span-3">
            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6">
              
                                        {t('footer.console_prototype')}
                                      </h4>
            <div className="flex flex-col gap-3">
              <button onClick={onExplore} className="text-xs text-gray-450 hover:text-primary transition-colors text-left cursor-pointer">{t('footer.prototype_dashboard')}</button>
              <button onClick={onExplore} className="text-xs text-gray-450 hover:text-primary transition-colors text-left cursor-pointer">{t('footer.ai_recommendations')}</button>
              <button onClick={onExplore} className="text-xs text-gray-450 hover:text-primary transition-colors text-left cursor-pointer">{t('footer.digital_twin')}</button>
              <button onClick={onExplore} className="text-xs text-gray-450 hover:text-primary transition-colors text-left cursor-pointer">{t('footer.farmer_registry')}</button>
              <button onClick={onExplore} className="text-xs text-gray-450 hover:text-primary transition-colors text-left cursor-pointer">{t('footer.analytics')}</button>
              <button onClick={onExplore} className="text-xs text-gray-450 hover:text-primary transition-colors text-left cursor-pointer">{t('footer.roadmap')}</button>
            </div>
          </div>

          {/* Column 4: Contact Details */}
          <div className="lg:col-span-3">
            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6">
              
                                        {t('footer.contact_us')}
                                      </h4>
            <div className="flex flex-col gap-4 text-xs text-gray-450">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="leading-relaxed">
                  <strong>{t('footer.samruddhi_organics')}</strong><br />
                  
                                                    {t('footer.belthangady')}<br />
                  
                                                    {t('footer.dakshina_kannada')}<br />
                  
                                                    {t('footer.karnataka_574217_india')}
                                                  </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <a href="tel:+919663541622" className="hover:text-primary transition-colors">
                  +91 96635 41622
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <a href="mailto:samruddhiorganics24@gmail.com" className="hover:text-primary transition-colors break-all">
                  
                                                    {t('footer.samruddhiorganics24_gmail_com')}
                                                  </a>
              </div>
              <div className="flex items-start gap-3">
                <LinkedInIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <a 
                  href="https://www.linkedin.com/company/samruddhiorganic/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors break-all"
                >
                  <strong>{t('footer.linkedin')}</strong><br />
                  <span className="text-[11px] text-gray-500">{t('footer.linkedin_com_company_samruddhiorganic')}</span>
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Row */}
        <div className="pt-8 flex flex-col items-center justify-center text-center gap-1.5 border-b border-gray-900/50 pb-6 text-2xs md:text-xs text-gray-500">
          <p className="font-normal">
            
                                  {t('footer.2026_samruddhi_organics_all_rights_reser')}
                                </p>
          <p className="font-bold text-gray-400">
            
                                  {t('footer.nutripalm_ai_ai_powered_precision_agricu')}
                                </p>
        </div>

        {/* Incubation Tag centered */}
        <div className="pt-6 text-center text-gray-600 text-3xs md:text-2xs uppercase tracking-widest font-extrabold">
          
                            {t('footer.nutripalm_ai_prototype_v1_0_developed_fo')}
                          </div>

      </div>
    </footer>
  );
};
