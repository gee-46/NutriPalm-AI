import { useTranslation } from "../translation/useTranslation";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Sparkles, ArrowRight, ArrowLeft, X, Sprout, BarChart3, MapPin, FlaskConical, Cpu, Globe } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { LanguageToggle } from "../translation/LanguageToggle";

interface PrototypeAuthProps {
  onAuthSuccess: () => void;
  onBackToLanding: () => void;
}

// Custom icons for bulletproof compile
const WheatIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 22 L22 2" />
    <path d="M9 10 a3 3 0 0 1 3-3 c1.5 0 2.5 1.5 2.5 3 S13.5 13 12 13 a3 3 0 0 1-3-3Z" />
    <path d="M12 12 a3 3 0 0 1 3-3 c1.5 0 2.5 1.5 2.5 3 S16.5 15 15 15 a3 3 0 0 1-3-3Z" />
    <path d="M6 14 a3 3 0 0 1 3-3 c1.5 0 2.5 1.5 2.5 3 S10.5 17 9 17 a3 3 0 0 1-3-3Z" />
    <path d="M14 8 a3 3 0 0 1 3-3 c1.5 0 2.5 1.5 2.5 3 S18.5 11 17 11 a3 3 0 0 1-3-3Z" />
  </svg>
);

const SatelliteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M13 7 L9 3 L3 9 l4 4" />
    <path d="m17 11 l4 4 l-6 6 l-4 -4" />
    <path d="m8 12 l4 4" />
    <path d="m16 8 l-4 -4" />
    <path d="M9 21 a3 3 0 0 0 3-3" />
  </svg>
);

export const PrototypeAuth: React.FC<PrototypeAuthProps> = ({ onAuthSuccess, onBackToLanding }) => {
    const { t } = useTranslation();
  const [phase, setPhase] = useState<"loading" | "login">("loading");
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    t('auth.step_0'),
    t('auth.step_1'),
    t('auth.step_2'),
    t('auth.step_3'),
    t('auth.step_4'),
    t('auth.step_5'),
    t('auth.step_6')
  ];

  // Floating background cards: size 120-180px, opacity 15-20%
  const floatingCards = [
    { icon: <Sprout className="w-8 h-8 text-primary" />, size: "w-36 h-36", top: "10%", left: "4%", delay: 0.2 },
    { icon: <WheatIcon className="w-8 h-8 text-primary" />, size: "w-32 h-32", top: "68%", left: "5%", delay: 1.5 },
    { icon: <FlaskConical className="w-8 h-8 text-primary" />, size: "w-40 h-40", top: "45%", left: "84%", delay: 3 },
    { icon: <SatelliteIcon className="w-8 h-8 text-primary" />, size: "w-44 h-44", top: "12%", left: "80%", delay: 0.8 },
    { icon: <Cpu className="w-7 h-7 text-primary" />, size: "w-30 h-30", top: "35%", left: "10%", delay: 2.2 },
    { icon: <Globe className="w-8 h-8 text-primary" />, size: "w-36 h-36", top: "78%", left: "82%", delay: 4.1 },
    { icon: <BarChart3 className="w-8 h-8 text-primary" />, size: "w-40 h-40", top: "64%", left: "75%", delay: 1.9 },
    { icon: <MapPin className="w-7 h-7 text-primary" />, size: "w-32 h-32", top: "8%", left: "16%", delay: 3.4 }
  ];

  // Loading Screen Progression
  useEffect(() => {
    if (phase !== "loading") return;

    const stepDuration = 550; // ms per step
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          const next = prev + 1;
          setProgress((next / (steps.length - 1)) * 100);
          return next;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setPhase("login");
          }, 850);
          return prev;
        }
      });
    }, stepDuration);

    return () => clearInterval(interval);
  }, [phase]);

  // Autofocus email field on Login Page phase
  useEffect(() => {
    if (phase === "login") {
      setTimeout(() => {
        if (emailInputRef.current) {
          emailInputRef.current.focus();
        }
      }, 500);
    }
  }, [phase]);

  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [fullName, setFullName] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Listen for Password Recovery events inside the component
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setPhase("login"); // Skip the loader and show the login card immediately
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleContinueAsDemo = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "demo@samruddhiorganics.in",
        password: "DemoUser123!",
      });

      if (error) throw error;
      onAuthSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in with demo credentials. Please ensure the demo user is seeded.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to redirect to Google OAuth.");
      setIsSubmitting(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      } else if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              user_role: "Agronomist", // Default fallback role
            },
          },
        });
        if (error) throw error;

        if (data?.session) {
          onAuthSuccess();
        } else {
          setSuccessMessage("Registration successful! Please check your email to verify your account.");
          setAuthMode("login");
        }
      } else if (authMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMessage("Password reset email sent! Check your inbox.");
        setAuthMode("login");
      } else if (authMode === "reset") {
        const { error } = await supabase.auth.updateUser({
          password: password,
        });
        if (error) throw error;
        setSuccessMessage("Password updated successfully! You can now sign in.");
        setAuthMode("login");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An authentication error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f8faf7] text-gray-900 flex flex-col items-center justify-start py-12 px-4">
      
      {/* ================= LAYER 1: BACKGROUND LAYER ================= */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        
        {/* 1. Large, Highly Visible Static Gradient Mesh Blobs (20-35% opacity) */}
        <div className="absolute -top-20 -left-20 w-[650px] h-[650px] bg-emerald-600/18 rounded-full blur-[140px]" />
        <div className="absolute -bottom-20 -right-20 w-[750px] h-[750px] bg-[#1B4D22]/18 rounded-full blur-[160px]" />
        <div className="absolute top-[35%] right-[10%] w-[550px] h-[550px] bg-[#66BB6A]/16 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] left-[-5%] w-[600px] h-[600px] bg-[#E8EFE5]/30 rounded-full blur-[110px]" />

        {/* 4. Visible Perspective Agricultural Field Grid Overlay (12-18% opacity) */}
        <div className="absolute inset-0 opacity-[0.14]">
          <svg className="w-full h-full stroke-primary/30 stroke-[0.8] fill-none">
            {/* Perspective field boundary lines */}
            <line x1="-30%" y1="100%" x2="35%" y2="0%" />
            <line x1="5%" y1="100%" x2="48%" y2="0%" />
            <line x1="40%" y1="100%" x2="60%" y2="0%" />
            <line x1="75%" y1="100%" x2="72%" y2="0%" />
            <line x1="110%" y1="100%" x2="85%" y2="0%" />
            <line x1="145%" y1="100%" x2="98%" y2="0%" />
            {/* Perspective cross segments representing field plots */}
            <line x1="0%" y1="10%" x2="100%" y2="10%" />
            <line x1="0%" y1="22%" x2="100%" y2="22%" />
            <line x1="0%" y1="38%" x2="100%" y2="38%" />
            <line x1="0%" y1="58%" x2="100%" y2="58%" />
            <line x1="0%" y1="82%" x2="100%" y2="82%" />
          </svg>
        </div>
      </div>

      {/* ================= LAYER 2: MIDDLE LAYER ================= */}
      <div className="absolute inset-0 z-1 select-none pointer-events-none">
        
        {/* 3. AI Digital Twin Connection Network (18-25% opacity) */}
        <div className="absolute inset-0 opacity-[0.20]">
          <svg className="w-full h-full stroke-primary/45 stroke-[0.9] fill-none">
            {/* Main trunk lines representing Farm Plot -> Sensors -> Twin -> AI -> Analytics */}
            <line x1="10%" y1="20%" x2="22%" y2="32%" />
            <line x1="22%" y1="32%" x2="15%" y2="68%" />
            <line x1="15%" y1="68%" x2="6%" y2="50%" />
            <line x1="6%" y1="50%" x2="10%" y2="20%" />

            <line x1="85%" y1="18%" x2="72%" y2="42%" />
            <line x1="72%" y1="42%" x2="88%" y2="72%" />
            <line x1="88%" y1="72%" x2="85%" y2="18%" />

            {/* Static glow nodes */}
            <circle cx="10%" cy="20%" r="2.5" className="fill-primary" />
            <circle cx="22%" cy="32%" r="2.5" className="fill-primary" />
            <circle cx="15%" cy="68%" r="2.5" className="fill-primary" />
            <circle cx="85%" cy="18%" r="2.5" className="fill-primary" />
            <circle cx="72%" cy="42%" r="2.5" className="fill-primary" />
            <circle cx="88%" cy="72%" r="2.5" className="fill-primary" />

            {/* Micro-interaction Network Sweep Pulse on step changes */}
            <AnimatePresence>
              <motion.circle
                key={currentStep}
                cx="50%"
                cy="50%"
                r="10"
                className="stroke-primary fill-primary/5 stroke-[1.5]"
                initial={{ scale: 0.05, opacity: 0 }}
                animate={{ scale: 18, opacity: [0, 0.45, 0] }}
                transition={{ duration: 0.65, ease: "easeOut" }}
              />
            </AnimatePresence>
          </svg>
        </div>

        {/* 5. Visible Digital Twin Wireframe Farm Illustration (12-18% opacity) */}
        <div className="absolute bottom-[10%] left-[8%] w-44 h-32 opacity-[0.15] text-primary">
          <svg viewBox="0 0 100 60" className="w-full h-full stroke-current stroke-[0.8] fill-none">
            {/* Isometric Field boundary blocks */}
            <polygon points="50,5 90,25 50,45 10,25" />
            <polygon points="50,15 80,30 50,45 20,30" className="stroke-primary/20" />
            {/* Plot vertical connectors */}
            <line x1="50" y1="5" x2="50" y2="45" />
            <line x1="30" y1="15" x2="70" y2="35" />
            <line x1="70" y1="15" x2="30" y2="35" />
            {/* Sensors */}
            <circle cx="50" cy="25" r="1.5" className="fill-primary" />
            {/* Scanning pulse across one field */}
            <motion.polygon
              points="50,5 90,25 50,45 10,25"
              className="stroke-[#66BB6A] stroke-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0], scale: [1, 1.04, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 5 }}
            />
          </svg>
        </div>
      </div>

      {/* ================= LAYER 3: FOREGROUND LAYER ================= */}
      <div className="absolute inset-0 z-2 select-none pointer-events-none">
        
        {/* 2. Static Background Decorative Panels (15-20% opacity) */}
        <div className="hidden lg:block">
          {floatingCards.map((card, idx) => (
            <div
              key={idx}
              className={`absolute bg-white/40 border border-gray-300/30 rounded-[28px] p-4 flex flex-col items-center justify-center pointer-events-none opacity-[0.15] shadow-sm ${card.size}`}
              style={{ top: card.top, left: card.left }}
            >
              <div className="p-3 bg-white/30 rounded-2xl shadow-2xs">
                {card.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= CONTENT PANEL ================= */}
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center justify-center my-auto sm:my-8">
        
        <AnimatePresence mode="wait">
          {phase === "loading" ? (
            <motion.div
              key="loader-container"
              className="w-full flex flex-col items-center text-center space-y-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Logo Frame with Pulsing Glow */}
              <div className="relative">
                {/* 7. Soft Static Radial Glow behind Logo */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[110px] -z-10" />
                
                {/* Logo Frame - Micro-interaction: gentle pulse on step change */}
                <motion.div 
                  key={currentStep}
                  className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-emerald-500/10 shadow-md p-1"
                  animate={{
                    scale: [1, 1.06, 1],
                  }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <img
                    src="/samruddhi-logo.jpeg"
                    alt={t('prototypeauth.samruddhi_organics')}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 border border-primary/20 rounded-xl" />
                </motion.div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-955">
                  
                                                    {t('prototypeauth.nutripalm')} <span className="text-primary font-black">{t('prototypeauth.ai')}</span>
                </h2>
                <p className="text-2xs text-[#2E7D32] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                  <Sparkles className="w-3 h-3" />
                  
                                                    {t('prototypeauth.ai_powered_precision_agriculture_platfor')}
                                                  </p>
              </div>

              {/* Step checklist stack */}
              <div className="w-full max-w-md bg-white/70 border border-gray-150 rounded-2xl p-6 shadow-xs backdrop-blur-xs space-y-3.5 text-left">
                {steps.map((step, idx) => {
                  const isCompleted = idx < currentStep;
                  const isActive = idx === currentStep;
                  return (
                    <motion.div
                      key={step}
                      className="flex items-center gap-3.5 text-xs transition-colors duration-350"
                      animate={{
                        opacity: isCompleted || isActive ? 1 : 0.25,
                        x: isActive ? 4 : 0
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      ) : isActive && idx < steps.length - 1 ? (
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : idx === steps.length - 1 && isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 animate-bounce" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                      )}
                      <span className={`font-bold ${isActive ? "text-primary" : isCompleted ? "text-gray-800" : "text-gray-400"}`}>
                        {step}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Progress bar container */}
              <div className="w-full max-w-md space-y-2.5">
                <div className="flex justify-between text-[10px] font-black text-gray-450 tracking-wider">
                  <span>{t('prototypeauth.booting_ecosystem')}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-primary relative"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: "easeInOut", duration: 0.2 }}
                  >
                    <motion.div
                      key={currentStep}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                    />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="login-container"
              className="w-full flex flex-col items-center text-center space-y-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Proper upper-left navigation component (Back to Home) */}
              <motion.button 
                onClick={onBackToLanding}
                className="fixed z-50 top-6 left-6 md:top-8 md:left-8 h-[40px] md:h-[46px] px-[16px] md:px-[22px] flex items-center gap-2 text-xs md:text-sm font-medium text-gray-700 bg-white/70 backdrop-blur-md border border-primary/20 rounded-full shadow-md hover:shadow-lg hover:text-primary hover:border-primary/60 hover:bg-emerald-50/40 transition-all duration-[250ms] ease-in-out cursor-pointer hover:-translate-y-[2px] active:scale-95 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-250 ease-in-out group-hover:-translate-x-[3px]" />
                
                                                  {t('prototypeauth.back_to_home')}
                                                </motion.button>
                                                
              <div className="fixed z-50 top-6 right-6 md:top-8 md:right-8">
                <LanguageToggle />
              </div>

              {/* Login Card Panel (15% larger: max-w-[490px], higher opacity, thicker borders) */}
              <div className="w-full max-w-[490px] bg-white/95 border-2 border-gray-200/80 rounded-[32px] p-10 md:p-12 shadow-2xl relative overflow-visible text-left">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-[#43A047]" />
                
                {/* Brand Logo & Tag */}
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/20 bg-white p-0.5">
                    <img
                      src="/samruddhi-logo.jpeg"
                      alt={t('prototypeauth.logo')}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-base font-extrabold tracking-tight text-gray-955">
                    
                                                              {t('prototypeauth.nutripalm')} <span className="text-primary font-black">{t('prototypeauth.ai')}</span>
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-extrabold text-gray-955 tracking-tight leading-tight mb-2">
                  {authMode === "login" && "Welcome to NutriPalm AI Console"}
                  {authMode === "signup" && "Create your Agronomist Account"}
                  {authMode === "forgot" && "Reset your Password"}
                  {authMode === "reset" && "Setup New Password"}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-6">
                  {authMode === "login" && "Enter your credentials to access the digital agronomy dashboard."}
                  {authMode === "signup" && "Register a new profile to start managing farm plots and twins."}
                  {authMode === "forgot" && "Provide your email address to receive a secure password recovery link."}
                  {authMode === "reset" && "Enter a new secure password for your console account."}
                </p>

                {/* Tab Switcher for Sign In / Sign Up */}
                {authMode !== "reset" && authMode !== "forgot" && (
                  <div className="flex border-b border-gray-200 mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setErrorMessage("");
                        setSuccessMessage("");
                      }}
                      className={`flex-1 pb-3 text-xs font-bold text-center transition-all cursor-pointer border-b-2 ${
                        authMode === "login"
                          ? "border-primary text-primary font-black"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      
                                                                    {t('prototypeauth.sign_in')}
                                                                  </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setErrorMessage("");
                        setSuccessMessage("");
                      }}
                      className={`flex-1 pb-3 text-xs font-bold text-center transition-all cursor-pointer border-b-2 ${
                        authMode === "signup"
                          ? "border-primary text-primary font-black"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      
                                                                    {t('prototypeauth.sign_up')}
                                                                  </button>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === "signup" && (
                    <div className="space-y-1.5">
                      <label htmlFor="auth-fullname" className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">{t('prototypeauth.full_name')}</label>
                      <input
                        type="text"
                        id="auth-fullname"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('prototypeauth.dr_l_ramana')}
                        className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/10 focus:border-primary transition-all text-xs text-gray-950 placeholder-gray-400 font-semibold"
                      />
                    </div>
                  )}

                  {authMode !== "reset" && (
                    <div className="space-y-1.5">
                      <label htmlFor="auth-email" className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">{t('prototypeauth.email_address')}</label>
                      <input
                        ref={emailInputRef}
                        type="email"
                        id="auth-email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('prototypeauth.e_g_agronomist_samruddhiorganics_in')}
                        className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/10 focus:border-primary transition-all text-xs text-gray-955 placeholder-gray-400 font-semibold"
                      />
                    </div>
                  )}

                  {authMode !== "forgot" && (
                    <div className="space-y-1.5">
                      <label htmlFor="auth-password" className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">
                        {authMode === "reset" ? "New Password" : "Password"}
                      </label>
                      <input
                        type="password"
                        id="auth-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/10 focus:border-primary transition-all text-xs text-gray-955 placeholder-gray-400"
                      />
                    </div>
                  )}

                  {/* Options (Login Remember me / Forgot Password Link) */}
                  {authMode === "login" && (
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 font-semibold">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary focus:ring-primary/20" />
                        
                                                                          {t('prototypeauth.remember_me')}
                                                                        </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        className="text-primary hover:underline font-bold bg-transparent border-0 cursor-pointer p-0"
                      >
                        
                                                                          {t('prototypeauth.forgot_password')}
                                                                        </button>
                    </div>
                  )}

                  {/* Back to Sign In Link for Forgot Password and Reset Password */}
                  {(authMode === "forgot" || authMode === "reset") && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        className="text-primary text-[11px] hover:underline font-bold bg-transparent border-0 cursor-pointer p-0"
                      >
                        
                                                                          {t('prototypeauth.back_to_sign_in')}
                                                                        </button>
                    </div>
                  )}

                  {/* Primary submit button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#166534] hover:bg-[#155e2e] text-white font-extrabold px-6 py-3.5 rounded-xl hover:shadow-lg active:scale-[0.99] transition-all duration-300 text-xs flex items-center justify-center gap-2 group cursor-pointer pt-3.5 pb-3.5 mt-6 border-0"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                        
                                                                          {t('prototypeauth.processing')}
                                                                        </>
                    ) : (
                      <>
                        {authMode === "login" && "Launch Console"}
                        {authMode === "signup" && "Create Account"}
                        {authMode === "forgot" && "Send Reset Link"}
                        {authMode === "reset" && "Update Password"}
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                  
                  {/* Google OAuth & Demo buttons - Only render if not resetting password */}
                  {authMode !== "reset" && (
                    <div className="space-y-3 pt-2">
                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold tracking-wider">{t('prototypeauth.or')}</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                      </div>

                      {/* Google Button */}
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isSubmitting}
                        className="w-full bg-white hover:bg-gray-50 text-gray-700 font-extrabold px-6 py-3.5 rounded-xl border border-gray-300 active:scale-[0.99] transition-all duration-300 text-xs flex items-center justify-center gap-3 cursor-pointer pt-3.5 pb-3.5"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        
                                                                          {t('prototypeauth.continue_with_google')}
                                                                        </button>

                      {/* Demo Account button */}
                      <button
                        type="button"
                        onClick={handleContinueAsDemo}
                        disabled={isSubmitting}
                        className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-extrabold px-6 py-3.5 rounded-xl border border-gray-250 hover:border-gray-350 active:scale-[0.99] transition-all duration-300 text-xs flex items-center justify-center gap-2 cursor-pointer pt-3.5 pb-3.5"
                      >
                        
                                                                          {t('prototypeauth.continue_with_demo_account')}
                                                                        </button>
                    </div>
                  )}
                </form>

              </div>
              
              {/* Refined Footer Note */}
              <div className="text-center space-y-1 text-gray-500 select-none max-w-sm leading-normal">
                <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest text-gray-800">
                  
                                                        {t('prototypeauth.prototype_demonstration')}
                                                      </p>
                <p className="text-[10px] font-semibold text-gray-650">
                  
                                                        {t('prototypeauth.built_exclusively_for_startup_incubation')}
                                                      </p>
                <p className="text-[9.5px] text-gray-400 font-normal">
                  
                                                        {t('prototypeauth.this_prototype_simulates_the_nutripalm_a')}
                                                      </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Local Error Toast Portal */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            className="fixed bottom-6 right-6 z-[999] p-4 rounded-2xl bg-white border border-red-200 text-red-800 backdrop-blur-lg shadow-xl flex items-start gap-3 w-80 md:w-96 text-left pointer-events-auto"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-grow">
              <p className="text-xs font-extrabold uppercase tracking-wider mb-1 text-red-600">
                
                                              {t('prototypeauth.authentication_error')}
                                            </p>
              <p className="text-[11.5px] font-normal leading-relaxed text-gray-700">
                {errorMessage}
              </p>
            </div>
            <button 
              onClick={() => setErrorMessage("")}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
