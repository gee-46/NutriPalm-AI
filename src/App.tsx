import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader } from './components/Loader'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { About } from './components/About'
import { ChallengeAndSolution } from './components/ChallengeAndSolution'
import { Features } from './components/Features'
import { Workflow } from './components/Workflow'
import { JourneyAndRoadmap } from './components/JourneyAndRoadmap'
import { DashboardPreview } from './components/DashboardPreview'
import { CTA } from './components/CTA'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { PrototypeApp } from './components/PrototypeApp'
import { PrototypeAuth } from './components/PrototypeAuth'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [transitionState, setTransitionState] = useState<"idle" | "fading-out" | "auth" | "dashboard">("idle")

  const handleExplore = () => {
    setTransitionState("fading-out");
    setTimeout(() => {
      setTransitionState("auth");
    }, 850);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <Loader key="loader" onComplete={() => setIsLoading(false)} />
        ) : transitionState === "idle" || transitionState === "fading-out" ? (
          <motion.div
            key="landing"
            className="flex flex-col min-h-screen"
            initial={{ opacity: 0 }}
            animate={
              transitionState === "fading-out"
                ? { opacity: 0, scale: 0.98, filter: "blur(12px)" }
                : { opacity: 1, scale: 1, filter: "blur(0px)" }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            {/* Navigation Header */}
            <Navbar onExplore={handleExplore} />

            {/* Main Sections */}
            <main className="flex-grow">
              <Hero onExplore={handleExplore} />
              <About />
              <ChallengeAndSolution />
              <Features />
              <Workflow />
              <DashboardPreview />
              <JourneyAndRoadmap />
              <CTA onExplore={handleExplore} />
              <Contact onExplore={handleExplore} />
            </main>

            {/* Footer */}
            <Footer onExplore={handleExplore} />
          </motion.div>
        ) : transitionState === "auth" ? (
          <motion.div
            key="auth-flow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PrototypeAuth 
              onAuthSuccess={() => setTransitionState("dashboard")} 
              onBackToLanding={() => setTransitionState("idle")} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="prototype"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <PrototypeApp onBackToLanding={() => setTransitionState("idle")} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default App
