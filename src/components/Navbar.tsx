import React, { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    { name: "About", href: "#about" },
    { name: "Features", href: "#features" },
    { name: "Workflow", href: "#workflow" },
    { name: "Roadmap", href: "#roadmap" },
    { name: "Contact", href: "#contact" },
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
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1B4D22] to-[#66BB6A] text-white shadow-md overflow-hidden">
            <svg
              className="w-6 h-6"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M50 75 Q50 50 50 35"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M50 55 C40 50 35 40 48 30 C50 38 48 48 50 55"
                fill="rgba(255, 255, 255, 0.2)"
                stroke="white"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path
                d="M50 45 C60 40 65 30 52 20 C50 28 52 38 50 45"
                fill="rgba(255, 255, 255, 0.4)"
                stroke="white"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <div className="flex flex-col justify-center text-left">
            <span className="text-sm font-extrabold tracking-tight text-gray-950 group-hover:text-primary transition-colors leading-tight">
              NutriPalm <span className="text-primary">AI</span>
            </span>
            <span className="text-[8px] font-bold text-gray-450 mt-1 leading-none uppercase tracking-wider">
              BY SAMRUDDHI ORGANICS
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

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="#dashboard"
            onClick={(e) => handleScrollTo(e, "#dashboard")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-[#235F26] active:scale-95 shadow-md shadow-primary/10 transition-all duration-200"
          >
            Explore Prototype
            <ArrowUpRight className="w-4 h-4" />
          </a>
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
              <a
                href="#dashboard"
                onClick={(e) => handleScrollTo(e, "#dashboard")}
                className="w-full flex items-center justify-center gap-1.5 px-6 py-4 rounded-xl text-base font-bold text-white bg-primary hover:bg-[#235F26] shadow-lg shadow-primary/15 transition-all"
              >
                Explore Prototype
                <ArrowUpRight className="w-5 h-5" />
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};
