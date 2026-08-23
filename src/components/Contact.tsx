import { useTranslation } from "../translation/useTranslation";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Phone, Mail, Send, Sparkles, CheckCircle2, X } from "lucide-react";

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

interface ContactProps {
  onExplore: () => void;
}

export const Contact: React.FC<ContactProps> = ({ onExplore }) => {
    const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    subject: "",
    message: "",
  });

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "info" }>>([]);

  const addToast = (message: string, type: "success" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic verification
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      addToast("Please fill in Name, Email, and Message fields.", "info");
      return;
    }

    addToast("Thank you for reaching out! This is a prototype demonstration. Our team will connect with you soon.", "success");
    
    // Clear form
    setFormData({
      name: "",
      email: "",
      organization: "",
      subject: "",
      message: "",
    });
  };

  const handleDemoRequest = () => {
    addToast("Demo Request Received! We will reach out to schedule a personalized preview session.", "success");
  };

  return (
    <section id="contact" className="py-24 relative overflow-hidden bg-[#F8FAF7]">
      {/* Background soft gradient blobs and grid */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-bl from-secondary/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#2E7D32 0.75px, transparent 0.75px)",
            backgroundSize: "24px 24px",
            opacity: 0.15
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black text-primary bg-primary/10 uppercase tracking-widest mb-4"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            
                                  {t('contact.get_in_touch')}
                                </motion.span>
          
          <motion.h2
            className="text-3xl md:text-4xl font-extrabold text-gray-950 tracking-tight leading-tight mb-4"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            
                                  {t('contact.let_s_build_the_future_of_precision_agri')}
                                </motion.h2>

          <motion.p
            className="text-sm md:text-base text-gray-500 leading-relaxed"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            
                                  {t('contact.whether_you_re_interested_in_nutripalm_a')}
                                </motion.p>
        </div>

        {/* Two-Column Form & Contact Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Left Side: Contact Information Cards */}
          <motion.div
            className="lg:col-span-5 space-y-6 text-left"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Address Card */}
            <div className="glass-card rounded-[24px] p-6 bg-white/70 border border-gray-150 backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex gap-4 items-start">
                <div className="p-3.5 bg-primary/10 rounded-2xl text-primary transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white shrink-0 duration-300">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-950 uppercase tracking-wider mb-2">{t('contact.office_address')}</h4>
                  <p className="text-sm text-gray-900 font-bold mb-0.5">{t('contact.samruddhi_organics')}</p>
                  <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                    
                                                          {t('contact.belthangady_dakshina_kannada')}<br />
                    
                                                          {t('contact.karnataka_574217_india')}
                                                        </p>
                </div>
              </div>
            </div>

            {/* Phone Card */}
            <div className="glass-card rounded-[24px] p-6 bg-white/70 border border-gray-150 backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex gap-4 items-start">
                <div className="p-3.5 bg-primary/10 rounded-2xl text-primary transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white shrink-0 duration-300">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-950 uppercase tracking-wider mb-2">{t('contact.phone')}</h4>
                  <a href="tel:+919663541622" className="text-sm md:text-base font-bold text-gray-900 hover:text-primary transition-colors">
                    +91 96635 41622
                  </a>
                  <p className="text-2xs text-gray-400 mt-1 uppercase tracking-wider">{t('contact.mon_sat_9_00_am_6_00_pm')}</p>
                </div>
              </div>
            </div>

            {/* Email Card */}
            <div className="glass-card rounded-[24px] p-6 bg-white/70 border border-gray-150 backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex gap-4 items-start">
                <div className="p-3.5 bg-primary/10 rounded-2xl text-primary transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white shrink-0 duration-300">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-950 uppercase tracking-wider mb-2">{t('contact.email')}</h4>
                  <a href="mailto:samruddhiorganics24@gmail.com" className="text-sm md:text-base font-bold text-gray-900 hover:text-primary transition-colors break-all">
                    
                                                          {t('contact.samruddhiorganics24_gmail_com')}
                                                        </a>
                  <p className="text-2xs text-gray-400 mt-1 uppercase tracking-wider">{t('contact.queries_reply_within_24_hours')}</p>
                </div>
              </div>
            </div>

            {/* LinkedIn Card */}
            <div className="glass-card rounded-[24px] p-6 bg-white/70 border border-gray-150 backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex gap-4 items-start">
                <div className="p-3.5 bg-primary/10 rounded-2xl text-primary transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white shrink-0 duration-300">
                  <LinkedInIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-950 uppercase tracking-wider mb-2">{t('contact.linkedin')}</h4>
                  <a 
                    href="https://www.linkedin.com/company/samruddhiorganic/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm md:text-base font-bold text-gray-900 hover:text-primary transition-colors break-all flex items-center gap-1"
                  >
                    
                                                          {t('contact.samruddhi_organics')}
                                                        </a>
                  <p className="text-2xs text-gray-400 mt-1 uppercase tracking-wider">{t('contact.follow_for_recent_platform_updates')}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Side: Form Card */}
          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="glass-card rounded-[32px] p-8 md:p-10 bg-white/80 border border-gray-150 backdrop-blur-md shadow-xl text-left">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name field */}
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-xs font-black text-gray-600 uppercase tracking-wider">{t('contact.full_name')}</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder={t('contact.e_g_john_doe')}
                      className="w-full px-4 py-3 bg-white/40 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400"
                    />
                  </div>
                  {/* Email field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-xs font-black text-gray-600 uppercase tracking-wider">{t('contact.email_address')}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={t('contact.e_g_john_company_com')}
                      className="w-full px-4 py-3 bg-white/40 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Organization field */}
                  <div className="space-y-2">
                    <label htmlFor="organization" className="block text-xs font-black text-gray-600 uppercase tracking-wider">{t('contact.organization')}</label>
                    <input
                      type="text"
                      id="organization"
                      name="organization"
                      value={formData.organization}
                      onChange={handleInputChange}
                      placeholder={t('contact.e_g_agri_farms_ltd')}
                      className="w-full px-4 py-3 bg-white/40 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400"
                    />
                  </div>
                  {/* Subject field */}
                  <div className="space-y-2">
                    <label htmlFor="subject" className="block text-xs font-black text-gray-600 uppercase tracking-wider">{t('contact.subject')}</label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder={t('contact.e_g_partnership_opportunity')}
                      className="w-full px-4 py-3 bg-white/40 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Message field */}
                <div className="space-y-2">
                  <label htmlFor="message" className="block text-xs font-black text-gray-600 uppercase tracking-wider">{t('contact.message')}</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder={t('contact.how_can_we_help_you')}
                    className="w-full px-4 py-3 bg-white/40 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400 resize-none"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-[#43A047] text-white font-extrabold px-6 py-3.5 rounded-xl hover:shadow-lg hover:brightness-105 active:scale-[0.99] transition-all duration-300 text-sm flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Send className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                  
                                                    {t('contact.send_message')}
                                                  </button>
              </form>
            </div>
          </motion.div>
        </div>

        {/* CTA Banner Section */}
        <motion.div
          className="glass-card rounded-[32px] p-8 md:p-10 bg-gradient-to-r from-primary/10 via-secondary/5 to-white border border-gray-150 backdrop-blur-md text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h3 className="text-lg md:text-xl font-extrabold text-gray-950 mb-3">
            
                                  {t('contact.interested_in_experiencing_nutripalm_ai_')}
                                </h3>
          <p className="text-xs md:text-sm text-gray-500 max-w-xl mx-auto mb-6">
            
                                  {t('contact.dive_straight_into_our_interactive_saas_')}
                                </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* Explore Prototype button */}
            <button
              onClick={async () => {
                if (onExplore && !isInitializing) {
                  setIsInitializing(true);
                  await new Promise((resolve) => setTimeout(resolve, 600));
                  onExplore();
                }
              }}
              disabled={isInitializing}
              className={`px-6 py-3 bg-gradient-to-r from-primary to-[#43A047] text-white font-extrabold text-xs md:text-sm rounded-xl transition-all duration-300 cursor-pointer w-full sm:w-auto flex items-center justify-center gap-2 ${
                isInitializing
                  ? "shadow-emerald-500/50 scale-[0.98] glow-green"
                  : "hover:shadow-md hover:brightness-105 active:scale-[0.98]"
              }`}
            >
              {isInitializing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  
                                                    {t('contact.initializing_nutripalm_ai')}
                                                  </>
              ) : (
                "Explore Prototype"
              )}
            </button>
            {/* Request a Demo button */}
            <button
              onClick={handleDemoRequest}
              className="px-6 py-3 bg-white border border-gray-200 hover:border-primary/30 text-gray-800 font-extrabold text-xs md:text-sm rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all duration-300 cursor-pointer w-full sm:w-auto"
            >
              
                                        {t('contact.request_a_demo')}
                                      </button>
          </div>
        </motion.div>
      </div>

      {/* Floating Glassmorphic Toast Portal */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`p-4 rounded-2xl border backdrop-blur-lg shadow-xl pointer-events-auto flex items-start gap-3 w-80 md:w-96 text-left ${
                toast.type === "success"
                  ? "bg-white/90 border-[#A5D6A7] text-[#1B5E20]"
                  : "bg-white/90 border-blue-200 text-blue-800"
              }`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="shrink-0 mt-0.5">
                <CheckCircle2 className={`w-5 h-5 ${toast.type === "success" ? "text-primary" : "text-blue-500"}`} />
              </div>
              <div className="flex-grow">
                <p className="text-xs font-extrabold uppercase tracking-wider mb-1">
                  {toast.type === "success" ? "Notification" : "Alert"}
                </p>
                <p className="text-[11.5px] font-normal leading-relaxed text-gray-700">
                  {toast.message}
                </p>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
};
