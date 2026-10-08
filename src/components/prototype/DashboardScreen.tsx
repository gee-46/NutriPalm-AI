import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect } from "react";
import { DashboardWeatherCard } from "./DashboardWeatherCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Cpu,
  Sparkles,
  Heart,
  ArrowRight,
  Activity,
  Calendar,
  Layers3,
  Compass,
  ArrowUpRight,
  Bot,
  X,
  FileText
} from "lucide-react";

// Premium Animated Counter Component
const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200; // 1.2s duration
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Cubic ease-out
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = easeProgress * value;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span>
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
      {suffix}
    </span>
  );
};

import type { Plot } from "../../data/plots";
import { supabase } from "../../lib/supabaseClient";

interface DashboardScreenProps {
  stats: {
    totalFarmers: number;
    totalFarms: number;
    mappedPlots: number;
    totalAcreage: number;
    activeTwins: number;
    recommendations: number;
    soilHealthScore: number;
  };
  plots: Plot[];
  currentUser: any;
  userProfile: any;
  onNavigate: (screen: string) => void;
  onStartDemo?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  stats,
  plots,
  currentUser,
  userProfile,
  onNavigate,
  onStartDemo
}) => {
    const { t } = useTranslation();
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);
  
  // Selected plot state for spatial map
  const [selectedPlot, setSelectedPlot] = useState<{
    id: string;
    farmer: string;
    crop: string;
    soilHealth: string;
    recommendation: string;
    lastInspection: string;
    status: "Healthy" | "Moderate" | "Needs Attention" | "Critical";
    statusColor: string;
  } | null>(null);

  // Time Greeting Calculation
  const getTimeGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t('dashboardscreen.good_morning', 'Good Morning');
    if (hour >= 12 && hour < 17) return t('dashboardscreen.good_afternoon', 'Good Afternoon');
    if (hour >= 17 && hour < 21) return t('dashboardscreen.good_evening', 'Good Evening');
    return t('dashboardscreen.good_night', 'Good Night');
  };

  const [greeting, setGreeting] = useState(getTimeGreeting());

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getTimeGreeting());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Display Name priority resolution
  const getUserDisplayName = (): string => {
    if (userProfile?.full_name) return userProfile.full_name;
    if (currentUser?.user_metadata?.full_name) return currentUser.user_metadata.full_name;
    if (currentUser?.user_metadata?.name) return currentUser.user_metadata.name;
    if (currentUser?.email) {
      const parts = currentUser.email.split("@")[0].split(/[._-]/);
      return parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
    return t('dashboardscreen.farmer', 'Farmer');
  };

  const displayRole = userProfile?.user_role || currentUser?.user_metadata?.role || t('dashboardscreen.lead_agronomist', 'Lead Agronomist');

  const activePlots = plots;

  // Recent activities list from database
  const [activities, setActivities] = useState<any[]>([]);
  // Real findings from the user's most recent saved recommendations
  const [observations, setObservations] = useState<Array<{ id: string; plotName: string; crop: string; createdAt: string; summary: string; deficient: string[] }>>([]);

  useEffect(() => {
    if (!currentUser) {
      setActivities([]);
      setObservations([]);
      return;
    }

    async function loadActivities() {
      try {
        const plotIds = plots.filter(p => !p.id.startsWith("plot-")).map(p => p.id);
        if (plotIds.length === 0) {
          setActivities([]);
          return;
        }

        // Fetch recent soil reports
        const { data: soilReports } = await supabase
          .from("soil_reports")
          .select("id, created_at, plot_id")
          .in("plot_id", plotIds)
          .order("created_at", { ascending: false })
          .limit(3);

        // Fetch recent recommendations
        const { data: recommendations } = await supabase
          .from("recommendations")
          .select("id, created_at, plot_id, crop, deficiencies, explanation")
          .in("plot_id", plotIds)
          .order("created_at", { ascending: false })
          .limit(3);

        const merged: any[] = [];

        // Add plot registrations
        plots.forEach(p => {
          merged.push({
            id: `plot-${p.id}`,
            time: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateObj: new Date(p.createdAt),
            title: "Plot Registered",
            desc: p.boundaryMapped ? `Boundary mapped for ${p.name} (${p.crop}).` : `${p.name} (${p.crop}) added.`,
            color: "bg-emerald-500",
            icon: <Layers3 className="w-3.5 h-3.5 text-white" />
          });
        });

        // Add soil reports
        if (soilReports) {
          soilReports.forEach((s: any) => {
            const plotName = plots.find(p => p.id === s.plot_id)?.name || "Plot";
            merged.push({
              id: `soil-${s.id}`,
              time: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              dateObj: new Date(s.created_at),
              title: "Soil Report Scanned",
              desc: `Chemical levels extracted for ${plotName}.`,
              color: "bg-indigo-500",
              icon: <FileText className="w-3.5 h-3.5 text-white" />
            });
          });
        }

        // Add recommendations
        if (recommendations) {
          recommendations.forEach((r: any) => {
            const plotName = plots.find(p => p.id === r.plot_id)?.name || "Plot";
            merged.push({
              id: `rec-${r.id}`,
              time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              dateObj: new Date(r.created_at),
              title: "Recommendation Generated",
              desc: `Custom recipe re-computed for ${plotName} (${r.crop}).`,
              color: "bg-amber-500",
              icon: <Sparkles className="w-3.5 h-3.5 text-white" />
            });
          });
        }

        setObservations(
          (recommendations ?? []).map((r: any) => {
            const findings = Array.isArray(r.deficiencies) ? r.deficiencies : [];
            const explanation = typeof r.explanation === "object" && r.explanation ? r.explanation : {};
            return {
              id: r.id,
              plotName: plots.find(p => p.id === r.plot_id)?.name || "Plot",
              crop: r.crop,
              createdAt: r.created_at,
              summary: explanation.summary || "",
              deficient: findings.filter((f: any) => f.status === "deficient").map((f: any) => f.display_name || f.nutrient),
            };
          })
        );

        merged.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
        setActivities(merged.slice(0, 5));
      } catch (err) {
        console.error("Failed to compile activity log:", err);
      }
    }

    loadActivities();
  }, [plots, currentUser]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 text-left"
    >
      {/* Premium Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            
                                  {t('dashboardscreen.nutripalm')} <span className="text-primary font-black">{t('dashboardscreen.ai')}</span>  {t('dashboardscreen.control_center')}
                                </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            
                                  {t('dashboardscreen.by_samruddhi_organics_real_time_agritech')}
                                </p>
        </div>
        <div className="flex items-center gap-3">
          {onStartDemo && (
            <button
              onClick={onStartDemo}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border-0 shadow-md shadow-indigo-650/10 cursor-pointer animate-pulse shrink-0"
            >
              <Sparkles className="w-4 h-4 fill-indigo-100" />
              
                                        {t('dashboardscreen.start_guided_demo')}
                                      </button>
          )}
          <div className="flex items-center gap-2 text-xs font-bold bg-white border border-gray-250 px-4 py-2.5 rounded-xl shadow-xs text-gray-650">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{t('dashboardscreen.telemetry_online_synced')}</span>
          </div>
        </div>
      </div>

      {/* AI Welcome Section (Status Strip) */}
      <motion.div 
        variants={itemVariants} 
        className="bg-emerald-50/40 border border-emerald-500/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold text-gray-700"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-gray-900">{greeting}, {getUserDisplayName()}</span>
          <span className="text-2xs text-primary bg-primary/10 border border-primary/10 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
            {displayRole}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {currentUser ? `${activePlots.length} ${activePlots.length === 1 ? t('dashboardscreen.farm_monitored', 'farm monitored') : t('dashboardscreen.farms_monitored', 'farms monitored')}` : t('dashboardscreen.4_farms_monitored_today')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {currentUser ? `${activePlots.length * 3} ${t('dashboardscreen.sensors_online', 'sensors online')}` : t('dashboardscreen.18_sensors_online')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t('dashboardscreen.ai_engine_active')}
          </span>
          <span className="flex items-center gap-1.5 text-gray-450 font-mono text-[11px]">
            {currentUser ? t('dashboardscreen.live_sync', 'Live Telemetry Synced') : t('dashboardscreen.last_sync_2_mins_ago')}
          </span>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* KPI 1 */}
        <motion.div 
          variants={itemVariants} 
          title={t('dashboardscreen.last_updated_2_mins_ago')}
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full">{t('dashboardscreen.12_mom')}</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('dashboardscreen.registered_farmers')}</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.totalFarmers} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-primary" 
              initial={{ width: 0 }}
              animate={{ width: "72%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 2 */}
        <motion.div 
          variants={itemVariants} 
          title={t('dashboardscreen.last_updated_2_mins_ago')}
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 text-[#2E7D32] rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Layers3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full">{t('dashboardscreen.gis_active')}</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('dashboardscreen.mapped_plots')}</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.mappedPlots} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-emerald-500" 
              initial={{ width: 0 }}
              animate={{ width: "85%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 3 */}
        <motion.div 
          variants={itemVariants} 
          title={t('dashboardscreen.last_updated_2_mins_ago')}
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-secondary/10 text-primary rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-[#2E7D32] bg-[#A5D6A7]/25 px-2.5 py-0.5 rounded-full border border-emerald-100/50">99.8%</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('dashboardscreen.digital_twins')}</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.activeTwins} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-primary" 
              initial={{ width: 0 }}
              animate={{ width: "92%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 4 */}
        <motion.div 
          variants={itemVariants} 
          title={t('dashboardscreen.last_updated_2_mins_ago')}
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-5 h-5 fill-indigo-50" />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-full">{t('dashboardscreen.ai_advisories')}</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('dashboardscreen.advisories_built')}</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.recommendations} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-indigo-500" 
              initial={{ width: 0 }}
              animate={{ width: "64%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 5: Soil Health Dial */}
        <motion.div 
          variants={itemVariants} 
          title={t('dashboardscreen.last_updated_2_mins_ago')}
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Heart className="w-5 h-5 fill-rose-50" />
            </div>
            
            {/* Glowing Radial Progress ring */}
            <div className="relative w-12 h-12 flex items-center justify-center filter drop-shadow-xs">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="#F1F5F0" strokeWidth="3.5" fill="transparent" />
                <motion.circle 
                  cx="24" 
                  cy="24" 
                  r="20" 
                  stroke="#2E7D32" 
                  strokeWidth="3.5" 
                  fill="transparent"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - stats.soilHealthScore / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeDasharray={2 * Math.PI * 20}
                />
              </svg>
              <span className="absolute text-[10px] font-black text-gray-800">
                <AnimatedCounter value={stats.soilHealthScore} suffix="%" />
              </span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">{t('dashboardscreen.avg_soil_index')}</p>
            <p className="text-sm font-extrabold text-gray-600 mt-0.5">{stats.soilHealthScore > 0 ? "From Digital Twin scores" : "No Digital Twin data yet"}</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content Sections: Farm Map & Overview + Weather & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Farm Overview Card & AI Observations side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Farm Overview Profile Card */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                  {t('dashboardscreen.plantation_summary')}
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-3 mb-4 font-sans">{t('dashboardscreen.farm_overview_profile')}</h3>
                
                <div className="space-y-2.5 text-xs text-gray-700">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">{t('dashboardscreen.total_mapped_land')}</span>
                    <span className="font-bold text-gray-850">
                      <AnimatedCounter value={stats.totalAcreage} decimals={2} suffix=" Acres" />
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">{t('dashboardscreen.crop_variety')}</span>
                    <span className="font-bold text-gray-850">
                      {plots.length > 0 ? Array.from(new Set(plots.map(p => p.crop).filter(Boolean))).join(" / ") : t('dashboardscreen.no_plots', 'No Plots Mapped')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">{t('dashboardscreen.iot_telemetry_nodes')}</span>
                    <span className="font-bold text-primary">
                      None connected
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">{t('dashboardscreen.irrigation_type')}</span>
                    <span className="font-bold text-gray-850">
                      {plots.length > 0 ? Array.from(new Set(plots.map(p => p.irrigation).filter(Boolean))).join(" / ") : t('dashboardscreen.not_configured', 'Not Configured')}
                    </span>
                  </div>
                </div>

                {/* 3. Farm Health Section */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-450 font-semibold">{t('dashboardscreen.farm_health_score')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-primary font-bold">{stats.soilHealthScore > 0 ? `${stats.soilHealthScore}%` : "N/A"}</span>
                      <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase">
                        {stats.soilHealthScore <= 0 ? "No data" : stats.soilHealthScore >= 80 ? t('dashboardscreen.healthy') : stats.soilHealthScore >= 50 ? t('dashboardscreen.moderate', 'Moderate') : t('dashboardscreen.critical', 'Critical')}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary" 
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.soilHealthScore}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* 3. Crop Growth Stage Section */}
                <div className="mt-4 space-y-2 text-xs">
                  <span className="text-gray-450 font-semibold block">{t('dashboardscreen.crop_growth_stage')}</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black">
                    <div className={`py-1.5 rounded-lg border ${(plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "vegetative" || (plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "seedling" ? "bg-primary/10 border-primary/20 text-primary" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                      {t('dashboardscreen.vegetative')}
                    </div>
                    <div className={`py-1.5 rounded-lg border ${(plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "flowering" || (plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "fruit development" ? "bg-primary/10 border-primary/20 text-primary" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                      {t('dashboardscreen.flowering')}
                    </div>
                    <div className={`py-1.5 rounded-lg border ${(plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "fruiting" || (plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "mature" || (plots.length > 0 ? plots[0].stage?.toLowerCase() : "") === "harvest ready" ? "bg-primary/10 border-primary/20 text-primary" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                      {t('dashboardscreen.fruiting')}
                    </div>
                  </div>
                </div>

              </div>
              <button 
                onClick={() => onNavigate("Farm Plots")}
                className="mt-6 w-full flex items-center justify-between text-xs font-bold text-primary hover:text-[#235F26] p-2 bg-emerald-50/50 rounded-xl hover:bg-emerald-50 transition-all border-0 cursor-pointer"
              >
                <span>{t('dashboardscreen.manage_farm_boundaries')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Latest findings from the user's saved recommendations */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                  <Bot className="w-3.5 h-3.5" />
                  Saved recommendations
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-3 mb-4">Latest findings</h3>

                <div className="space-y-3.5 text-xs text-gray-700">
                  {observations.length === 0 ? (
                    <p className="text-xs text-gray-450 italic font-semibold">
                      No recommendations yet. Upload a soil report and generate one to see findings here.
                    </p>
                  ) : (
                    observations.map((o) => (
                      <div
                        key={o.id}
                        className={`p-3 border rounded-2xl ${o.deficient.length ? "bg-amber-50/50 border-amber-100" : "bg-emerald-50/50 border-emerald-100"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-gray-800 text-[11px]">{o.plotName}</span>
                          <span className="text-[9px] font-mono text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-gray-700 leading-normal mt-1">
                          {o.deficient.length ? `Deficient: ${o.deficient.join(", ")}.` : "No nutrient deficiency found."}
                        </p>
                        {o.summary && <p className="text-[11px] text-gray-500 mt-1">{o.summary}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <button
                onClick={() => onNavigate("Recommendations")}
                className="mt-6 w-full flex items-center justify-between text-xs font-bold text-indigo-700 hover:text-indigo-850 p-2 bg-indigo-50/50 rounded-xl hover:bg-indigo-50 transition-all border-0 cursor-pointer"
              >
                <span>{t('dashboardscreen.open_advisory_console')}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>

          {/* Map and AI Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* GIS Plot Boundary Map Card (7/12 width) */}
            <motion.div variants={itemVariants} className="md:col-span-7 bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-gray-50/50">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                      <Compass className="w-4.5 h-4.5 text-primary" />
                      
                                                                {t('dashboardscreen.gis_plot_boundary_overview')}
                                                              </h3>
                    <p className="text-[11px] text-gray-450 mt-0.5">{t('dashboardscreen.click_on_plots_for_detailed_diagnostic_o')}</p>
                  </div>
                </div>
                
                {/* 6. Map Canvas with clickable popup popovers */}
                <div className="h-64 bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:25px_25px] opacity-40" />
                  
                  <svg className="w-full h-full relative z-10 opacity-90" viewBox="0 0 500 200">
                    {activePlots.map((plot) => (
                      <path
                        key={plot.id}
                        d={plot.svgPath}
                        fill={plot.fillGradient}
                        stroke={plot.strokeColor}
                        strokeWidth="2"
                        strokeDasharray={!plot.boundaryMapped ? "4 4" : "0"}
                        onClick={() => {
                          setSelectedPlot({
                            id: plot.name,
                            farmer: plot.farmer || getUserDisplayName(),
                            crop: plot.crop,
                            soilHealth: plot.soilReportAttached ? t('dashboardscreen.analyzed_npk', 'Analyzed NPK') : t('dashboardscreen.pending_scan', 'Pending Scan'),
                            recommendation: plot.soilReportAttached ? t('dashboardscreen.advisory_issued', 'Advisory Issued') : t('dashboardscreen.upload_report_first', 'Upload soil report to run AI model'),
                            lastInspection: plot.lastInspection || t('dashboardscreen.just_now', 'Just Now'),
                            status: plot.status,
                            statusColor: plot.statusColor
                          });
                        }}
                        className="hover:fill-white/10 hover:stroke-white transition-all cursor-pointer"
                      />
                    ))}
                    
                    {/* Active telemetry pins */}
                    {(
                      activePlots.map((plot) => {
                        if (!plot.geoJSON?.coordinates?.[0]?.[0]) return null;
                        const coords = plot.geoJSON.coordinates[0];
                        const lngs = coords.map(c => c[0]);
                        const lats = coords.map(c => c[1]);
                        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
                        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
                        const W = 500, H = 250, PAD = 30;
                        const avgLng = lngs.reduce((a,b)=>a+b,0)/lngs.length;
                        const avgLat = lats.reduce((a,b)=>a+b,0)/lats.length;
                        const x = PAD + ((avgLng - minLng) / (maxLng - minLng || 1)) * (W - PAD * 2);
                        const y = PAD + ((maxLat - avgLat) / (maxLat - minLat || 1)) * (H - PAD * 2);
                        
                        return (
                          <g key={`pin-${plot.id}`} transform={`translate(${x}, ${y})`} className="animate-pulse pointer-events-none">
                            <circle cx="0" cy="0" r="10" fill={plot.status === 'Critical' ? 'rgba(225, 29, 72, 0.4)' : 'rgba(46, 125, 50, 0.4)'} />
                            <circle cx="0" cy="0" r="4" fill="#FFF" />
                          </g>
                        );
                      })
                    )}
                  </svg>
                  
                  {/* Selected Plot Popup Overlay */}
                  <AnimatePresence>
                    {selectedPlot && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-x-4 top-4 bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-800 text-xs text-white z-20 shadow-lg text-left"
                      >
                        <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 mb-2">
                          <span className="font-extrabold text-[12px] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {selectedPlot.id}  {t('dashboardscreen.diagnostic_hud')}
                                                                                </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlot(null);
                            }}
                            className="text-gray-400 hover:text-white cursor-pointer border-0 bg-transparent"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-gray-300 text-[11px] font-sans">
                          <p><span className="text-gray-500 font-bold">{t('dashboardscreen.farmer')}</span> {selectedPlot.farmer}</p>
                          <p><span className="text-gray-500 font-bold">{t('dashboardscreen.crop')}</span> {selectedPlot.crop}</p>
                          <p><span className="text-gray-500 font-bold">{t('dashboardscreen.soil_health')}</span> {selectedPlot.soilHealth}</p>
                          <p><span className="text-gray-500 font-bold">{t('dashboardscreen.inspection')}</span> {selectedPlot.lastInspection}</p>
                          <p className="col-span-2 border-t border-slate-850 pt-1.5 mt-1">
                            <span className="text-primary font-extrabold">{t('dashboardscreen.ai_recommendation')}</span> {selectedPlot.recommendation}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-emerald-400 shadow-sm">
                    
                                                          {t('dashboardscreen.spatial_coordinates_epsg_4326_zone_44n')}
                                                        </div>
                </div>
              </div>
              
              <button
                onClick={() => onNavigate("Farm Plots")}
                className="w-full flex items-center justify-between text-xs font-bold text-primary hover:text-[#235F26] p-4 bg-linear-to-r from-gray-50 to-white hover:bg-gray-100/50 transition-all border-0 border-t border-gray-100 cursor-pointer"
              >
                <span>{t('dashboardscreen.launch_interactive_map_viewer')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>

            {/* Data coverage: what the account actually has on file */}
            <motion.div variants={itemVariants} className="md:col-span-5 bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left relative overflow-hidden flex flex-col justify-between h-full">
              <div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                  <Cpu className="w-3.5 h-3.5" />
                  Data coverage
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-3 mb-4 font-sans">What is on file</h3>
                <div className="space-y-3 text-xs text-gray-700 font-semibold">
                  <div className="flex justify-between"><span>Plots</span><span className="font-black">{plots.length}</span></div>
                  <div className="flex justify-between"><span>With a surveyed boundary</span><span className="font-black">{plots.filter(p => p.boundaryMapped).length}</span></div>
                  <div className="flex justify-between"><span>With a soil report</span><span className="font-black">{plots.filter(p => p.soilReportAttached).length}</span></div>
                  <div className="flex justify-between"><span>Digital Twin snapshots stored</span><span className="font-black">{stats.activeTwins}</span></div>
                  <div className="flex justify-between"><span>Recommendations saved</span><span className="font-black">{stats.recommendations}</span></div>
                  <div className="flex justify-between"><span>IoT sensors connected</span><span className="font-black text-gray-400">None</span></div>
                </div>
              </div>
            </motion.div>

          </div>

        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          
          {/* Weather for the user's first mapped plot (Open-Meteo) */}
          <motion.div variants={itemVariants}>
            <DashboardWeatherCard plot={plots.find((p) => p.geoJSON)} />
          </motion.div>

          {/* 8. Recent Activity Dotted Timeline */}
          <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left">
            <h3 className="font-extrabold text-gray-900 text-sm mb-6 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-primary" />
              
                                        {t('dashboardscreen.recent_activity_timeline')}
                                      </h3>
            
            <div className="relative pl-8 border-l border-gray-100 space-y-6">
              {activities.length === 0 ? (
                <p className="text-xs text-gray-450 italic font-semibold">{t('dashboardscreen.no_recent_activity', 'No recent activity')}</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="relative">
                    {/* Timeline Dot with Icon inside */}
                    <span className={`absolute -left-[45px] top-0.5 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-md ${act.color}`}>
                      {act.icon}
                    </span>
                    
                    <div className="space-y-1 ml-2">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-gray-850">{act.title}</h4>
                        <span className="text-[9px] font-mono text-gray-400 bg-gray-50 border border-gray-150 px-1.5 py-0.5 rounded">{act.time}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{act.desc}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* 9. Floating AI Assistant (Collapsible/Expandable drawer) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        <AnimatePresence>
          {isAssistantExpanded ? (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-80 md:w-96 bg-white/95 border-2 border-primary/20 rounded-3xl shadow-2xl p-6 backdrop-blur-md mb-3 text-left relative overflow-hidden"
            >
              {/* Green gradient top strip */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-secondary" />
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                  <Bot className="w-4 h-4" />
                  
                                                    {t('dashboardscreen.nutripalm_ai_assistant')}
                                                  </span>
                <button 
                  onClick={() => setIsAssistantExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-full hover:bg-gray-50 border-0 bg-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4 text-xs">
                {/* Today's Insights */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-gray-450 uppercase text-[10px] tracking-wider">{t('dashboardscreen.today_s_insights')}</h4>
                  <p className="text-gray-700 leading-normal bg-gray-50 border border-gray-100 p-2.5 rounded-xl font-medium">
                    {currentUser ? (
                      activePlots.length === 0 ? (
                        t('dashboardscreen.insight_no_data', 'No diagnostics computed. Create a plot to start monitoring.')
                      ) : (
                        <>
                          {activePlots.filter(p => p.status === 'Critical' || p.status === 'Needs Attention').length} {t('dashboardscreen.attention_needed', 'plots require nutrient calibration.')}<br />
                          {t('dashboardscreen.total_land_monitored', 'Total monitored land area is')} {stats.totalAcreage.toFixed(2)} {t('dashboardscreen.acres', 'acres.')}
                        </>
                      )
                    ) : (
                      <>
                        {t('dashboardscreen.3_farms_require_potassium_nitrogen_calib')}<br />
                        {t('dashboardscreen.vegetation_leaf_rate_up_14_2_in_plot_2a')}
                      </>
                    )}
                  </p>
                </div>

                {/* Pending Recommendations */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-gray-455 uppercase text-[10px] tracking-wider">{t('dashboardscreen.pending_recommendations')}</h4>
                  <p className="text-gray-700 leading-normal bg-gray-50 border border-gray-100 p-2.5 rounded-xl font-medium">
                    {currentUser ? (
                      activePlots.length === 0 ? (
                        t('dashboardscreen.no_pending_advisories', 'No pending AI advisories in logs.')
                      ) : (
                        <>
                          {activePlots.filter(p => !p.soilReportAttached).length} {t('dashboardscreen.plots_pending_soil', 'plots pending laboratory soil reports.')}<br />
                          {activePlots.filter(p => p.soilReportAttached).length} {t('dashboardscreen.advisories_generated', 'advisories compiled and ready for review.')}
                        </>
                      )
                    ) : (
                      <>
                        {t('dashboardscreen.formulate_potash_supplement_recipe_for_p')}<br />
                        {t('dashboardscreen.approve_slow_release_npk_a_prescription_')}
                      </>
                    )}
                  </p>
                </div>

                {/* Weather Alerts */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-gray-455 uppercase text-[10px] tracking-wider">{t('dashboardscreen.weather_alerts')}</h4>
                  <p className="text-gray-700 leading-normal bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl text-amber-900 font-medium">
                    {currentUser ? (
                      activePlots.length === 0 ? (
                        t('dashboardscreen.alerts_inactive', 'Alert triggers fully operational and active.')
                      ) : (
                        t('dashboardscreen.weather_advisory_active', 'Regional microclimate conditions synced. Precision irrigation enabled.')
                      )
                    ) : (
                      t('dashboardscreen.rainfall_expected_tomorrow_irrigation_cy')
                    )}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2 pt-1">
                  <h4 className="font-extrabold text-gray-450 uppercase text-[10px] tracking-wider">{t('dashboardscreen.quick_actions')}</h4>
                  <div className="grid grid-cols-2 gap-2 text-center font-bold">
                    <button 
                      onClick={() => {
                        onNavigate("Recommendations");
                        setIsAssistantExpanded(false);
                      }}
                      className="py-2.5 bg-primary hover:bg-[#235F26] text-white rounded-xl text-[10px] transition-colors border-0 cursor-pointer"
                    >
                      {t('dashboardscreen.ai_advisories')}
                    </button>
                    <button 
                      onClick={() => {
                        onNavigate("Soil Reports");
                        setIsAssistantExpanded(false);
                      }}
                      className="py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-250 rounded-xl text-[10px] transition-colors cursor-pointer"
                    >
                      {t('dashboardscreen.soil_scans')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/95 border-2 border-primary/20 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center gap-3.5 cursor-pointer hover:shadow-2xl hover:border-primary/40 hover:-translate-y-0.5 transition-all text-xs"
              onClick={() => setIsAssistantExpanded(true)}
            >
              <div className="p-2 bg-primary text-white rounded-xl animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-950 flex items-center gap-1">
                  {t('dashboardscreen.nutripalm_ai')}
                </p>
                <p className="text-gray-500 font-bold mt-0.5">
                  {currentUser ? (
                    activePlots.length === 0 ? t('dashboardscreen.no_plots_register', 'Create a plot to configure telemetry scans.') : (
                      (() => {
                        const attentionPlots = activePlots.filter(p => p.status === 'Critical' || p.status === 'Needs Attention').length;
                        return attentionPlots === 0
                          ? t('dashboardscreen.all_plots_healthy', 'All plots operating in optimal status.')
                          : `${attentionPlots} ${attentionPlots === 1 ? t('dashboardscreen.plot_requires_attention', 'plot requires attention today.') : t('dashboardscreen.plots_require_attention', 'plots require attention today.')}`;
                      })()
                    )
                  ) : t('dashboardscreen.3_farms_require_attention_today')}
                </p>
                <p className="text-[10px] text-primary font-black mt-1 uppercase tracking-wider flex items-center gap-0.5">
                  {t('dashboardscreen.view_summary')} <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  );
};
