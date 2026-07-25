import React, { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavbarProps {
  onExplore?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onExplore }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleExploreClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onExplore && !isInitializing) {
      setIsInitializing(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      onExplore();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "#home" },
    { name: "About Us", href: "#about" },
    { name: "Problems", href: "#problem" },
    { name: "Solutions", href: "#solution" },
    { name: "Features", href: "#features" },
    { name: "Workflow", href: "#workflow" },
    { name: "Console Preview", href: "#dashboard" },
    { name: "Roadmap", href: "#roadmap" },
  ];

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      const topOffset = 80; // height of navbar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? "glass-nav py-4 shadow-sm"
          : "bg-transparent py-6"
      }`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo and Brand */}
        <a href="#home" onClick={(e) => handleScrollTo(e, "#home")} className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl overflow-hidden border border-gray-200/50 shadow-xs shrink-0 bg-white">
            <img
              src="/samruddhi-logo.jpeg"
              alt="Samruddhi Organics Logo"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex flex-col justify-center text-left">
            <span className="text-sm font-extrabold tracking-tight text-gray-950 group-hover:text-primary transition-colors leading-tight">
              NutriPalm <span className="text-primary">AI</span>
            </span>
            <span className="text-[8px] font-semibold text-gray-500 mt-1 leading-none tracking-wider">
              by Samruddhi Organics
            </span>
          </div>
        </a>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-sm font-medium text-gray-600 hover:text-primary transition-colors relative py-1 group"
            >
              {link.name}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={handleExploreClick}
            disabled={isInitializing}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-[#235F26] active:scale-95 transition-all duration-300 cursor-pointer ${
              isInitializing
                ? "shadow-emerald-500/50 scale-[0.98] glow-green"
                : "shadow-md shadow-primary/10 hover:shadow-primary/20"
            }`}
          >
            {isInitializing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                Initializing NutriPalm AI...
              </>
            ) : (
              <>
                Explore Prototype
                <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-x-0 top-[72px] bottom-0 z-30 bg-white/95 backdrop-blur-lg flex flex-col px-6 py-8 border-t border-gray-100 md:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col gap-6 mb-8">
              {navLinks.map((link, idx) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleScrollTo(e, link.href)}
                  className="text-lg font-semibold text-gray-800 hover:text-primary transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {link.name}
                </motion.a>
              ))}
            </div>

            <motion.div
              className="mt-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleExploreClick(e);
                }}
                disabled={isInitializing}
                className={`w-full flex items-center justify-center gap-1.5 px-6 py-4 rounded-xl text-base font-bold text-white bg-primary hover:bg-[#235F26] transition-all cursor-pointer ${
                  isInitializing
                    ? "shadow-emerald-500/50 scale-[0.98] glow-green"
                    : "shadow-lg shadow-primary/15"
                }`}
              >
                {isInitializing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    Initializing NutriPalm AI...
                  </>
                ) : (
                  <>
                    Explore Prototype
                    <ArrowUpRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};
