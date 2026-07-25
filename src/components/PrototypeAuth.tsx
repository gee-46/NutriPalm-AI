import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Sparkles, ArrowRight, ArrowLeft, X, Sprout, BarChart3, MapPin, FlaskConical, Cpu, Globe, ShieldAlert } from "lucide-react";

interface PrototypeAuthProps {
  onAuthSuccess: () => void;
  onBackToLanding: () => void;
}

// Custom icons for bulletproof compile
const WheatIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 22 22 2" />
    <path d="M9 10a3 3 0 0 1 3-3c1.5 0 2.5 1.5 2.5 3S13.5 13 12 13a3 3 0 0 1-3-3Z" />
    <path d="M12 12a3 3 0 0 1 3-3c1.5 0 2.5 1.5 2.5 3S16.5 15 15 15a3 3 0 0 1-3-3Z" />
    <path d="M6 14a3 3 0 0 1 3-3c1.5 0 2.5 1.5 2.5 3S10.5 17 9 17a3 3 0 0 1-3-3Z" />
    <path d="M14 8a3 3 0 0 1 3-3c1.5 0 2.5 1.5 2.5 3S18.5 11 17 11a3 3 0 0 1-3-3Z" />
  </svg>
);

const SatelliteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M13 7 9 3 3 9l4 4" />
    <path d="m17 11 4 4-6 6-4-4" />
    <path d="m8 12 4 4" />
    <path d="m16 8-4-4" />
    <path d="M9 21a3 3 0 0 0 3-3" />
  </svg>
);

export const PrototypeAuth: React.FC<PrototypeAuthProps> = ({ onAuthSuccess, onBackToLanding }) => {
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
    "Loading Platform Resources...",
    "Initializing Farmer Registry...",
    "Preparing Digital Twin Engine...",
    "Loading Soil Intelligence...",
    "Configuring Recommendation Engine...",
    "Preparing Analytics Dashboard...",
    "Platform Ready"
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

  const handleContinueAsDemo = () => {
    setEmail("demo@nutripalm.ai");
    setPassword("NutriPalm@2026");
    setIsSubmitting(true);
    setErrorMessage("");
    
    // Simulate Signing In for 1.5 seconds
    setTimeout(() => {
      onAuthSuccess();
    }, 1500);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (email !== "demo@nutripalm.ai" || password !== "NutriPalm@2026") {
      setErrorMessage("Invalid demo credentials. Please use the provided demo account.");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate Signing In for 1.5 seconds
    setTimeout(() => {
      onAuthSuccess();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAF7] text-gray-900 flex items-center justify-center overflow-hidden">
      
      {/* ================= LAYER 1: BACKGROUND LAYER ================= */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        
        {/* 1. Large, Highly Visible Gradient Mesh Blobs (20-35% opacity) */}
        <motion.div 
          className="absolute -top-20 -left-20 w-[650px] h-[650px] bg-emerald-600/22 rounded-full blur-[140px]"
          animate={{
            x: [0, 60, -40, 0],
            y: [0, -40, 50, 0],
          }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-20 -right-20 w-[750px] h-[750px] bg-[#1B4D22]/22 rounded-full blur-[160px]"
          animate={{
            x: [0, -70, 45, 0],
            y: [0, 60, -35, 0],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-[35%] right-[10%] w-[550px] h-[550px] bg-[#66BB6A]/20 rounded-full blur-[120px]"
          animate={{
            x: [0, 45, -55, 0],
            y: [0, 55, -45, 0],
          }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-[20%] left-[-5%] w-[600px] h-[600px] bg-[#E8EFE5]/35 rounded-full blur-[110px]"
          animate={{
            x: [0, -40, 60, 0],
            y: [0, -30, 70, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 4. Visible Perspective Agricultural Field Grid Overlay (12-18% opacity) */}
        <motion.div 
          className="absolute inset-0 opacity-[0.14]"
          animate={{
            x: [-6, 6, -6],
            y: [-8, 8, -8],
          }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
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
        </motion.div>
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
        
        {/* 2. Floating Glass Panels (Drifting on sides, 15-20% opacity) */}
        <div className="hidden lg:block">
          {floatingCards.map((card, idx) => (
            <motion.div
              key={idx}
              className={`absolute bg-white/50 border border-gray-300/40 rounded-[28px] p-4 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none opacity-[0.16] shadow-md ${card.size}`}
              style={{ top: card.top, left: card.left }}
              animate={{
                y: [0, -16, 0],
                x: [0, 10, 0],
                rotate: [0, 2.5, -2.5, 0]
              }}
              transition={{
                duration: 8 + Math.random() * 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: card.delay
              }}
            >
              <div className="p-3 bg-white/40 rounded-2xl shadow-2xs">
                {card.icon}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 6. High-Density Floating Particles (Glowing dots, seeds, pollen, leaves) */}
        <div className="absolute inset-0 opacity-[0.20]">
          {[...Array(16)].map((_, i) => {
            const isLeafSilhouette = i % 4 === 0;
            return (
              <motion.div
                key={i}
                className={`absolute rounded-full ${
                  isLeafSilhouette ? "w-2.5 h-1.5 bg-primary/25" : "w-1 h-1 bg-primary/40"
                }`}
                style={{
                  top: `${Math.random() * 85 + 10}%`,
                  left: `${Math.random() * 80 + 10}%`,
                }}
                animate={{
                  y: [0, -90, 0],
                  x: [0, Math.random() * 24 - 12, 0],
                  opacity: [0, 0.6, 0],
                  rotate: isLeafSilhouette ? [0, 180, 360] : 0
                }}
                transition={{
                  duration: 7 + Math.random() * 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: Math.random() * 3,
                }}
              />
            );
          })}
        </div>

        {/* 8. Micro leaf drifting across */}
        <motion.div
          className="absolute text-primary/10 w-7 h-7"
          initial={{ x: "-10%", y: "45%", rotate: 0 }}
          animate={{
            x: "110%",
            y: ["45%", "35%", "50%", "40%"],
            rotate: 270
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
            <path d="M17,8C8,8,4,16,4,16s4,2,9-3c3.87-3.87,4-9,4-9S17,4,17,8z" />
          </svg>
        </motion.div>
      </div>

      {/* ================= CONTENT PANEL ================= */}
      <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center justify-center min-h-screen">
        
        <AnimatePresence mode="wait">
          {phase === "loading" ? (
            <motion.div
              key="loader-container"
              className="w-full flex flex-col items-center text-center space-y-8"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.99 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              {/* Logo Frame with Pulsing Glow */}
              <div className="relative">
                {/* 7. Soft Radial Glow behind Logo (radius 500-700px, 5s breathing) */}
                <motion.div 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/12 rounded-full blur-[110px] -z-10"
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.35, 0.65, 0.35],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
                
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
                    alt="Samruddhi Organics"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 border border-primary/20 rounded-xl" />
                </motion.div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-955">
                  NutriPalm <span className="text-primary font-black">AI</span>
                </h2>
                <p className="text-2xs text-[#2E7D32] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                  <Sparkles className="w-3 h-3" />
                  AI Powered Precision Agriculture Platform
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
                  <span>BOOTING ECOSYSTEM</span>
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Proper upper-left navigation component (Back to Home) */}
              <motion.button 
                onClick={onBackToLanding}
                className="fixed z-50 top-6 left-6 md:top-8 md:left-8 h-[40px] md:h-[46px] px-[16px] md:px-[22px] flex items-center gap-2 text-xs md:text-sm font-medium text-gray-700 bg-white/70 backdrop-blur-md border border-primary/20 rounded-full shadow-md hover:shadow-lg hover:text-primary hover:border-primary/60 hover:bg-emerald-50/40 transition-all duration-[250ms] ease-in-out cursor-pointer hover:-translate-y-[2px] active:scale-95 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-250 ease-in-out group-hover:-translate-x-[3px]" />
                Back to Home
              </motion.button>

              {/* Login Card Panel (15% larger: max-w-[490px], higher opacity, thicker borders) */}
              <div className="w-full max-w-[490px] bg-white/95 border-2 border-gray-200/80 rounded-[32px] p-10 md:p-12 shadow-2xl relative overflow-hidden text-left">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
                
                {/* Brand Logo & Tag */}
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/20 bg-white p-0.5">
                    <img
                      src="/samruddhi-logo.jpeg"
                      alt="Logo"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-base font-extrabold tracking-tight text-gray-950">
                    NutriPalm <span className="text-primary font-black">AI</span>
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight leading-tight mb-2">
                  Welcome to NutriPalm AI Console
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-8">
                  Enter your credentials to access the digital agronomy dashboard.
                </p>

                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="auth-email" className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">Email Address</label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      id="auth-email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. agronomist@samruddhiorganics.in"
                      className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/10 focus:border-primary transition-all text-xs text-gray-950 placeholder-gray-400 font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="auth-password" className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">Password</label>
                    <input
                      type="password"
                      id="auth-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/10 focus:border-primary transition-all text-xs text-gray-950 placeholder-gray-400"
                    />
                  </div>

                  {/* Options */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 font-semibold">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary focus:ring-primary/20" />
                      Remember me
                    </label>
                    <span className="flex items-center gap-1 text-primary">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Prototype Secure Channel
                    </span>
                  </div>

                  {/* Primary Launch Console button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-primary to-[#43A047] text-white font-extrabold px-6 py-3.5 rounded-xl hover:shadow-lg hover:brightness-105 active:scale-[0.99] transition-all duration-300 text-xs flex items-center justify-center gap-2 group cursor-pointer pt-3.5 pb-3.5 mt-6"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        Launch Console
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                  
                  {/* Secondary Continue with Demo Account button */}
                  <button
                    type="button"
                    onClick={handleContinueAsDemo}
                    disabled={isSubmitting}
                    className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-extrabold px-6 py-3.5 rounded-xl border border-gray-250 hover:border-gray-350 active:scale-[0.99] transition-all duration-300 text-xs flex items-center justify-center gap-2 cursor-pointer pt-3.5 pb-3.5"
                  >
                    Continue with Demo Account
                  </button>
                </form>

              </div>
              
              {/* Refined Footer Note */}
              <div className="text-center space-y-1 text-gray-500 select-none max-w-sm leading-normal">
                <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest text-gray-800">
                  Prototype Demonstration
                </p>
                <p className="text-[10px] font-semibold text-gray-650">
                  Built exclusively for startup incubation and product showcase.
                </p>
                <p className="text-[9.5px] text-gray-400 font-normal">
                  This prototype simulates the NutriPalm AI experience using demonstration data.
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
                Authentication Error
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
