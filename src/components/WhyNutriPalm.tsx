import React, { useEffect, useState, useRef } from "react";
import { useInView, motion } from "framer-motion";
import { Brain, Layers3, TestTube, TreePine } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

interface CounterProps {
  value: number;
  duration?: number;
  suffix?: string;
}

const AnimatedCounter: React.FC<CounterProps> = ({ value, duration = 1.5, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const stepTime = 25;
      const totalSteps = (duration * 1000) / stepTime;
      const increment = end / totalSteps;

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          clearInterval(timer);
          setCount(end);
        } else {
          setCount(Math.floor(start));
        }
      }, stepTime);

      return () => clearInterval(timer);
    }
  }, [isInView, value, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

export const WhyNutriPalm: React.FC = () => {
  const stats = [
    {
      icon: <Brain className="w-5 h-5 text-[#2E7D32]" />,
      title: "AI-Driven Decisions",
      description: "Our recommendations use deep agricultural neural nets for highly precise farm forecasts.",
      value: 98,
      suffix: "%",
      statLabel: "Accuracy Rate"
    },
    {
      icon: <Layers3 className="w-5 h-5 text-sky-600" />,
      title: "Digital Farm Intelligence",
      description: "Acres virtualized as layered digital twins across various climate and regional topologies.",
      value: 450,
      suffix: "k+",
      statLabel: "Managed Acres"
    },
    {
      icon: <TestTube className="w-5 h-5 text-amber-600" />,
      title: "Smart Fertilizer Planning",
      description: "Drastically reduce excessive NPK input, maintaining optimal crop nutrient absorption.",
      value: 35,
      suffix: "%",
      statLabel: "Chemical Waste Saved"
    },
    {
      icon: <TreePine className="w-5 h-5 text-emerald-600" />,
      title: "Sustainable Agriculture",
      description: "Improve micro-organic soil content and capture carbon credit indices per season.",
      value: 12,
      suffix: "x",
      statLabel: "ROI on Soil Quality"
    }
  ];

  return (
    <section id="why" className="py-24 bg-mesh relative overflow-hidden border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="mb-16 flex justify-center">
          <SectionHeading
            eyebrow="By the Numbers"
            title="Why NutriPalm AI?"
            description="We merge software efficiency with agricultural expertise to build measurable improvements in yield, sustainability, and profit."
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              className="glass-card rounded-2xl p-6 flex flex-col justify-between text-left hover:scale-[1.02] transition-transform duration-300 bg-white"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div>
                {/* Icon Circle */}
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center w-10 h-10 mb-6">
                  {stat.icon}
                </div>

                {/* Big Number */}
                <div className="text-4xl font-extrabold text-gray-900 tracking-tight mb-1 flex items-baseline">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                
                {/* Stat Label */}
                <span className="text-[10px] font-bold text-[#2E7D32] uppercase tracking-wider block mb-4">
                  {stat.statLabel}
                </span>

                {/* Title */}
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  {stat.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 leading-relaxed">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
