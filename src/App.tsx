import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader } from './components/Loader'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { About } from './components/About'
import { ChallengeAndSolution } from './components/ChallengeAndSolution'
import { WhyNutriPalm } from './components/WhyNutriPalm'
import { Features } from './components/Features'
import { Workflow } from './components/Workflow'
import { JourneyAndRoadmap } from './components/JourneyAndRoadmap'
import { DashboardPreview } from './components/DashboardPreview'
import { CTA } from './components/CTA'
import { Footer } from './components/Footer'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <Loader onComplete={() => setIsLoading(false)} />
        ) : (
          <motion.div
            className="flex flex-col min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Navigation Header */}
            <Navbar />

            {/* Main Sections */}
            <main className="flex-grow">
              <Hero />
              <About />
              <ChallengeAndSolution />
              <WhyNutriPalm />
              <Features />
              <Workflow />
              <JourneyAndRoadmap />
              <DashboardPreview />
              <CTA />
            </main>

            {/* Footer */}
            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default App
