import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoaderProps {
  onComplete: () => void;
}

export const Loader: React.FC<LoaderProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0); // 0: seed, 1: organic shoot growing, 2: logo details, 3: fade out

  useEffect(() => {
    // Stage 0 -> Stage 1: 600ms (seed dot appears, then stem and shoots start)
    const t1 = setTimeout(() => setStage(1), 600);
    // Stage 1 -> Stage 2: 2400ms (organic stem grows & leaves unfurl, then circuit logo highlights)
    const t2 = setTimeout(() => setStage(2), 2400);
    // Stage 2 -> Stage 3 (Complete): 3800ms (hold logo, then fade out and transition)
    const t3 = setTimeout(() => {
      setStage(3);
      setTimeout(onComplete, 800);
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage < 3 && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8FAF7] px-6 select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }}
        >
          {/* Centered Vertical Stack */}
          <div className="flex flex-col items-center justify-center text-center max-w-sm w-full gap-8">
            
            {/* Symmetrical Plant SVG Frame */}
            <div className="relative flex items-center justify-center h-32 w-32">
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Seed Dot */}
                {stage >= 0 && (
                  <motion.circle
                    cx="50"
                    cy="70"
                    r="4"
                    fill="#2E7D32"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                )}

                {/* Symmetrical Plant Grow Assembly */}
                {stage >= 1 && (
                  <>
                    {/* Main Stem - grows straight up */}
                    <motion.path
                      d="M50 70 L50 35"
                      stroke="#2E7D32"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />
                    
                    {/* Left Leaf - Two-Phase Organic Unfurling (Vertical Shoot -> Horizontal Unfurl) */}
                    <motion.path
                      d="M50 35 C38 32 30 18 48 15 C50 24 49 32 50 35"
                      fill="url(#leafGradientLeft)"
                      stroke="#2E7D32"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ 
                        pathLength: 0, 
                        scaleX: 0, 
                        scaleY: 0, 
                        originX: 0.5, 
                        originY: 0.35 
                      }}
                      animate={{ 
                        pathLength: 1, 
                        scaleY: 1,
                        scaleX: 1
                      }}
                      transition={{ 
                        pathLength: { duration: 0.8, delay: 0.4, ease: "easeOut" },
                        scaleY: { duration: 0.6, delay: 0.4, ease: "easeOut" }, // vertical growth
                        scaleX: { duration: 0.6, delay: 0.8, ease: "easeOut" }  // horizontal unfurl
                      }}
                    />

                    {/* Right Leaf - Symmetrical Two-Phase Organic Unfurling */}
                    <motion.path
                      d="M50 35 C62 32 70 18 52 15 C50 24 51 32 50 35"
                      fill="url(#leafGradientRight)"
                      stroke="#66BB6A"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ 
                        pathLength: 0, 
                        scaleX: 0, 
                        scaleY: 0, 
                        originX: 0.5, 
                        originY: 0.35 
                      }}
                      animate={{ 
                        pathLength: 1, 
                        scaleY: 1,
                        scaleX: 1
                      }}
                      transition={{ 
                        pathLength: { duration: 0.8, delay: 0.5, ease: "easeOut" },
                        scaleY: { duration: 0.6, delay: 0.5, ease: "easeOut" }, // vertical growth
                        scaleX: { duration: 0.6, delay: 0.9, ease: "easeOut" }  // horizontal unfurl
                      }}
                    />
                  </>
                )}

                {/* Symmetrical AI tech circuit details */}
                {stage >= 2 && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <path d="M48 15 L40 10" stroke="#A5D6A7" strokeWidth="1" strokeLinecap="round" />
                    <path d="M52 15 L60 10" stroke="#A5D6A7" strokeWidth="1" strokeLinecap="round" />
                    <circle cx="40" cy="10" r="1.5" fill="#A5D6A7" />
                    <circle cx="60" cy="10" r="1.5" fill="#A5D6A7" />
                  </motion.g>
                )}

                <defs>
                  <linearGradient id="leafGradientLeft" x1="50" y1="35" x2="30" y2="15" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#2E7D32" />
                    <stop offset="100%" stopColor="#66BB6A" />
                  </linearGradient>
                  <linearGradient id="leafGradientRight" x1="50" y1="35" x2="70" y2="15" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#66BB6A" />
                    <stop offset="100%" stopColor="#A5D6A7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Typography Stack */}
            <div className="flex flex-col items-center">
              <motion.h1
                className="text-3xl font-extrabold tracking-tight text-[#1F2937] mb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={stage >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                NutriPalm <span className="text-[#2E7D32]">AI</span>
              </motion.h1>

              <motion.p
                className="text-[10px] font-bold tracking-[0.2em] text-[#66BB6A] uppercase mb-4"
                initial={{ opacity: 0 }}
                animate={stage >= 2 ? { opacity: 0.8 } : { opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                by Samruddhi Organics
              </motion.p>

              {/* Slogan details */}
              <div className="h-6 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  {stage === 1 ? (
                    <motion.p
                      key="slogan1"
                      className="text-[#6B7280] font-medium text-xs italic"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      Planted in Science...
                    </motion.p>
                  ) : stage >= 2 ? (
                    <motion.p
                      key="slogan2"
                      className="text-[#2E7D32] font-semibold text-xs tracking-wider"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      Growing Smarter Agriculture
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-48 h-[3px] bg-[#E5E7EB] rounded-full overflow-hidden mt-2 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-[#2E7D32] via-[#66BB6A] to-[#A5D6A7]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.6, ease: "easeInOut" }}
              />
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
