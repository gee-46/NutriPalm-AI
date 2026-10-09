import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import {
  LayoutDashboard,
  Users,
  Map,
  Cpu,
  FileText,
  FlaskConical,
  BarChart3,
  Settings,
  User,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bell,
  ArrowLeft,
  Bug,
  Sprout,
  CloudSun,
  History as HistoryIcon
} from "lucide-react";

import { DashboardScreen } from "./prototype/DashboardScreen";
import { FarmerScreen } from "./prototype/FarmerScreen";
import type { Farmer } from "./prototype/FarmerScreen";
import { FarmPlotScreen } from "./prototype/FarmPlotScreen";
import { DigitalTwinScreen } from "./prototype/DigitalTwinScreen";
import { SoilReportScreen } from "./prototype/SoilReportScreen";
import { RecommendationScreen } from "./prototype/RecommendationScreen";
import { AnalyticsScreen } from "./prototype/AnalyticsScreen";
import { SettingsScreen } from "./prototype/SettingsScreen";
import { NotFoundScreen } from "./prototype/NotFoundScreen";
import { DiseaseScreen } from "./prototype/DiseaseScreen";
import { CropSuitabilityScreen } from "./prototype/CropSuitabilityScreen";
import { WeatherAdvisoryScreen } from "./prototype/WeatherAdvisoryScreen";
import { HistoryScreen } from "./prototype/HistoryScreen";
import {
  DashboardSkeleton,
  FarmerTableSkeleton,
  SoilReportSkeleton,
  AnalyticsSkeleton,
  GenericSkeleton
} from "./prototype/LoadingSkeletons";
import { LanguageToggle } from "../translation/LanguageToggle";
import { useTranslation } from "../translation/useTranslation";
import { LANGUAGE_STORAGE_KEY } from "../translation/LanguageContext";
import { usePlots } from "../data/plots";
import { useApiHealth } from "../lib/useApiHealth";
import { fetchFarmers, createFarmer, deleteFarmer } from "../data/farmers";
import type { NewFarmerInput } from "../data/farmers";

interface PrototypeAppProps {
  onBackToLanding: () => void;
}

export const PrototypeApp: React.FC<PrototypeAppProps> = ({ onBackToLanding }) => {
  const { t } = useTranslation();
  const { plots } = usePlots();
  const apiHealth = useApiHealth();
  const [currentScreen, setCurrentScreen] = useState("Dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isScreenLoading, setIsScreenLoading] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Drop any per-browser cached data so the next account on this device starts clean.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("nutripalm") && k !== LANGUAGE_STORAGE_KEY) // the language is a device preference, not account data
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // storage unavailable; nothing to clear
    }
    onBackToLanding();
  };

  const changeScreen = (screenName: string) => {
    setIsScreenLoading(true);
    setCurrentScreen(screenName);
    setTimeout(() => {
      setIsScreenLoading(false);
    }, 600);
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Only real events are added here (no seeded sample notifications). `key` is a translation key.
  const [notifications, setNotifications] = useState<Array<{ id: number; key: string; read: boolean }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [recommendationPlotId, setRecommendationPlotId] = useState<string>("");

  useEffect(() => {
    const getSessionAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user);
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (data) {
            setUserProfile(data);
          }
        }
      } catch (err) {
        console.error("Failed to load user session/profile", err);
      }
    };

    getSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      if (session?.user) {
        setCurrentUser(session.user);
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) {
          setUserProfile(data);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const avatarUrl =
    currentUser?.user_metadata?.avatar_url ||
    currentUser?.user_metadata?.picture ||
    userProfile?.profile_photo_url;

  const getInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }
    const name = currentUser?.user_metadata?.full_name || currentUser?.email || "U";
    return name[0].toUpperCase();
  };

  const displayName = userProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email || "Farmer";
  const displayRole = userProfile?.user_role || "Farmer";

  // Reusable Toast Notification System
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "info" | "warning" }>>([]);
  // Stable identity: children (e.g. the boundary surveyor) list this in effect
  // dependencies, and a new function every render would tear their state down.
  const showToast = useCallback((message: string, type: "success" | "info" | "warning" = "success") => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Shared state: list of farmers
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  // Database calculated statistics (for logged in users)
  const [dbStats, setDbStats] = useState({
    activeTwins: 0,
    recommendations: 0,
    soilHealthScore: 0
  });

  // Signed in: the user's own farmers from the database. Signed out: clearly-labelled sample data.
  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      fetchFarmers(currentUser.id)
        .then((rows) => {
          if (!cancelled) setFarmers(rows);
        })
        .catch((err) => {
          console.error("Failed to load farmers:", err);
          if (!cancelled) {
            setFarmers([]);
            showToast(t("p2.app.farmers_load_error"), "warning");
          }
        });
    } else {
      setFarmers([]);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Fetch live stats from database tables for the logged-in user
  useEffect(() => {
    let isMounted = true;
    if (!currentUser) return;

    async function fetchStats() {
      try {
        const plotIds = plots.map(p => p.id);
        
        let twinsCount = 0;
        let recsCount = 0;
        let avgSoilScore = 0;

        if (plotIds.length > 0) {
          // Fetch digital twins count
          const { data: twinsData, error: twinsError } = await supabase
            .from("digital_twins")
            .select("plot_id, crop_health_score")
            .in("plot_id", plotIds);

          if (!twinsError && twinsData) {
            twinsCount = twinsData.length;
            const healthScores = (twinsData as Array<{ crop_health_score: number | null }>)
              .map((d): number | null => d.crop_health_score)
              .filter((s): s is number => typeof s === 'number' && s > 0);
            if (healthScores.length > 0) {
              avgSoilScore = Math.round(healthScores.reduce((a: number, b: number) => a + b, 0) / healthScores.length);
            }
          }

          // Fetch recommendations count
          const { data: recsData, error: recsError } = await supabase
            .from("recommendations")
            .select("id")
            .in("plot_id", plotIds);

          if (!recsError && recsData) {
            recsCount = recsData.length;
          }
        }

        if (isMounted) {
          setDbStats({
            activeTwins: twinsCount,
            recommendations: recsCount,
            soilHealthScore: avgSoilScore
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats from Supabase:", err);
      }
    }

    fetchStats();
    return () => { isMounted = false; };
  }, [plots, currentUser]);

  // Derive stats dynamically (authenticated vs. unauthenticated)
  const stats = {
    totalFarmers: farmers.length,
    totalFarms: plots.length,
    mappedPlots: plots.filter(p => p.boundaryMapped).length,
    totalAcreage: plots.reduce((acc, p) => acc + p.area, 0),
    activeTwins: dbStats.activeTwins,
    recommendations: dbStats.recommendations,
    soilHealthScore: dbStats.soilHealthScore
  };

  // Add a farmer (persisted to Supabase for the signed-in user)
  const handleAddFarmer = async (input: NewFarmerInput) => {
    if (!currentUser) throw new Error("Sign in to save farmer profiles.");
    const created = await createFarmer(currentUser.id, input);
    setFarmers((prev) => [created, ...prev]);
    showToast(t("p2.app.farmer_added", { name: created.name }), "success");
  };

  const handleDeleteFarmer = async (id: string) => {
    await deleteFarmer(id);
    setFarmers((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSoilReportUploaded = useCallback((data: any) => {
    // Only announce a saved report; unsaved/low-confidence results are shown on the Soil Reports screen.
    if (!data?.persisted) return;
    setNotifications((prev) => [
      { id: Date.now(), key: "p2.app.soil_saved", read: false },
      ...prev
    ]);
  }, []);

  const handleRecommendationNavigate = useCallback((plotId?: string) => {
    if (plotId) {
      setRecommendationPlotId(plotId);
    }
    changeScreen("Recommendations");
  }, [changeScreen]);

  // Navigations mapping
  const iconCls = "w-5 h-5";
  const navGroups: Array<{ key: string; items: Array<{ name: string; icon: React.ReactNode }> }> = [
    { key: "p2.nav.group.home", items: [{ name: "Dashboard", icon: <LayoutDashboard className={iconCls} /> }] },
    {
      key: "p2.nav.group.farms",
      items: [
        { name: "Farmers", icon: <Users className={iconCls} /> },
        { name: "Farm Plots", icon: <Map className={iconCls} /> }
      ]
    },
    {
      key: "p2.nav.group.health",
      items: [
        { name: "Soil Reports", icon: <FileText className={iconCls} /> },
        { name: "Disease Intelligence", icon: <Bug className={iconCls} /> },
        { name: "Weather", icon: <CloudSun className={iconCls} /> },
        { name: "Digital Twin", icon: <Cpu className={iconCls} /> }
      ]
    },
    { key: "p2.nav.group.suitability", items: [{ name: "Crop Suitability", icon: <Sprout className={iconCls} /> }] },
    { key: "p2.nav.group.recommendations", items: [{ name: "Recommendations", icon: <FlaskConical className={iconCls} /> }] },
    {
      key: "p2.nav.group.history",
      items: [
        { name: "History", icon: <HistoryIcon className={iconCls} /> },
        { name: "Analytics", icon: <BarChart3 className={iconCls} /> }
      ]
    },
    {
      key: "p2.nav.group.profile",
      items: [
        { name: "Profile", icon: <User className={iconCls} /> },
        { name: "Settings", icon: <Settings className={iconCls} /> }
      ]
    }
  ];

  const renderNav = (collapsed: boolean, onPick?: () => void) => (
    <nav aria-label={t("p2.nav.main")} className="px-3 text-left">
      {navGroups.map((group) => (
        <div key={group.key} className="mb-3">
          {collapsed ? (
            <hr className="my-2 border-gray-150" />
          ) : (
            <p className="px-3 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wide text-gray-500">{t(group.key)}</p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isSelected = currentScreen === item.name;
              return (
                <li key={item.name}>
                  <button
                    onClick={() => {
                      changeScreen(item.name);
                      onPick?.();
                    }}
                    aria-current={isSelected ? "page" : undefined}
                    aria-label={t(`sidebar.${item.name}`)}
                    title={t(`sidebar.${item.name}`)}
                    className={`w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all border-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSelected
                      ? "bg-primary text-white shadow-md shadow-primary/10"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                  >
                    <span className="shrink-0" aria-hidden="true">{item.icon}</span>
                    {!collapsed && <span className="leading-snug">{t(`sidebar.${item.name}`)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );


  const renderLoadingSkeleton = () => {
    switch (currentScreen) {
      case "Dashboard":
        return <DashboardSkeleton />;
      case "Farmers":
        return <FarmerTableSkeleton />;
      case "Soil Reports":
        return <SoilReportSkeleton />;
      case "Analytics":
        return <AnalyticsSkeleton />;
      default:
        return <GenericSkeleton />;
    }
  };

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case "Dashboard":
        return (
          <DashboardScreen
            stats={stats}
            plots={plots}
            currentUser={currentUser}
            userProfile={userProfile}
            onNavigate={changeScreen}
            onOpenRecommendation={handleRecommendationNavigate}
          />
        );
      case "Farmers":
        return (
          <FarmerScreen
            farmers={farmers}
            onCreateFarmer={currentUser ? handleAddFarmer : undefined}
            onDeleteFarmer={currentUser ? handleDeleteFarmer : undefined}
            onNavigate={changeScreen}
            showToast={showToast}
          />
        );
      case "Farm Plots":
        return (
          <FarmPlotScreen
            farmers={farmers.map((f) => ({ id: f.id, name: f.name }))}
            onPlotCreated={() => showToast(t("p2.app.plot_saved"), "success")}
            onNavigate={changeScreen}
            showToast={showToast}
          />
        );
      case "Digital Twin":
        return (
          <DigitalTwinScreen
            onNavigate={changeScreen}
            showToast={showToast}
          />
        );
      case "Soil Reports":
        return (
          <SoilReportScreen
            onRecommendationClick={handleRecommendationNavigate}
            onUploadSuccess={handleSoilReportUploaded}
            showToast={showToast}
          />
        );
      case "Recommendations":
        return (
          <RecommendationScreen
            selectedPlotId={recommendationPlotId}
            onPlotChange={(plotId) => setRecommendationPlotId(plotId)}
            showToast={showToast}
            farmerName={displayName}
            onNavigate={changeScreen}
          />
        );
      case "Disease Intelligence":
        return <DiseaseScreen onNavigate={changeScreen} />;
      case "Crop Suitability":
        return <CropSuitabilityScreen onNavigate={changeScreen} />;
      case "Weather":
        return <WeatherAdvisoryScreen onNavigate={changeScreen} />;
      case "History":
        return <HistoryScreen onNavigate={changeScreen} onOpenRecommendation={handleRecommendationNavigate} />;
      case "Analytics":
        return <AnalyticsScreen onNavigate={changeScreen} />;
      case "Settings":
        return (
          <SettingsScreen
            activeSection="Theme"
            onSaveSuccess={() => showToast(t("p2.app.settings_saved"), "success")}
          />
        );
      case "Profile":
        return (
          <SettingsScreen
            activeSection="Profile"
            onSaveSuccess={() => showToast(t("p2.app.profile_saved"), "success")}
          />
        );
      default:
        return <NotFoundScreen onBack={() => changeScreen("Dashboard")} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAF7] text-gray-800">

      {/* Sidebar - Desktop */}
      <motion.aside
        animate={{ width: isSidebarCollapsed ? "80px" : "240px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="hidden md:flex flex-col justify-between bg-white border-r border-gray-150 h-screen sticky top-0 shrink-0 overflow-y-auto select-none"
      >
        <div>
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-150 mb-4 h-[72px] overflow-hidden">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-250 shadow-xs bg-white shrink-0">
              <img
                src="/samruddhi-logo.jpeg"
                alt={t("p2.ui.samruddhi_organics_logo_ytkuov")}
                className="w-full h-full object-cover"
              />
            </div>
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col text-left"
              >
                <span className="text-xs font-extrabold tracking-tight text-gray-900 leading-tight">
                  NutriPalm <span className="text-primary font-bold">AI</span>
                </span>
                <span className="text-[8px] font-semibold text-gray-400 leading-none mt-1 tracking-wider">
                  {t("p2.ui.by_samruddhi_organics_1y0cqdj")}
                </span>
              </motion.div>
            )}
          </div>

          {/* Sidebar Nav Items */}
          {renderNav(isSidebarCollapsed)}
        </div>

        {/* Sidebar Footer (Collapse Toggle + Back to Landing) */}
        <div className="p-3 border-t border-gray-150 space-y-2">
          {/* Sign Out button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-all border-0 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            {!isSidebarCollapsed && <span>{t('app.sign_out')}</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-850 hover:bg-gray-50 transition-all border-0 cursor-pointer"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!isSidebarCollapsed && <span>{t('app.collapse_sidebar')}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Top Header */}
        <header className="h-[72px] bg-white border-b border-gray-150 flex items-center justify-between px-6 z-20">
          {/* Left: Mobile menu toggle + Page title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={t("p2.nav.open_menu")}
              className="md:hidden p-2 hover:bg-gray-100 rounded-xl text-gray-700 active:scale-95 transition-all border-0 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <span>{t('app.console_title')}</span>
              <span className="text-gray-300">/</span>
              <span className="text-primary font-extrabold">{t(`sidebar.${currentScreen}`)}</span>
            </div>
          </div>

          {/* Right: Notifications & Profile Quick Card */}
          <div className="flex items-center gap-4">
            <LanguageToggle />
            {/* System Status Online */}
            <div
              role="status"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold ${
                apiHealth === "online"
                  ? "border-emerald-100 bg-emerald-50 text-primary"
                  : apiHealth === "offline"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${apiHealth === "online" ? "bg-primary" : apiHealth === "offline" ? "bg-rose-500" : "bg-gray-400"}`} />
              {apiHealth === "online" ? t("p2.app.api_online") : apiHealth === "offline" ? t("p2.app.api_offline") : t("p2.app.api_checking")}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsRead();
                }}
                aria-label={t("p2.app.bell")}
                className="min-h-11 min-w-11 p-2.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition-all relative border border-gray-200 cursor-pointer bg-white"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white" />
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-gray-150 shadow-lg p-4 text-left space-y-3 z-30"
                  >
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t("p2.app.notifications")}</span>
                      {unreadCount > 0 && (
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-full">{t("p2.app.new_alerts")}</span>
                      )}
                    </div>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {notifications.length === 0 && (
                        <p className="text-sm font-medium text-gray-600">{t("p2.app.no_notifications")}</p>
                      )}
                      {notifications.map((n) => (
                        <div key={n.id} className="text-sm border-b border-gray-50 pb-2">
                          <p className="text-gray-700 leading-snug">{t(n.key)}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Avatar Card */}
            <div
              onClick={() => changeScreen("Profile")}
              className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded-xl transition-all"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={currentUser?.email || "avatar"}
                  className="w-8 h-8 rounded-full object-cover border border-primary/20 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shrink-0">
                  {getInitials()}
                </div>
              )}
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[10px] font-bold text-gray-800 leading-tight">{displayName}</span>
                <span className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider">{displayRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Drawer Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black z-30 md:hidden"
              />

              {/* Sidebar drawer */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 bottom-0 left-0 w-64 bg-white z-40 p-4 border-r border-gray-100 flex flex-col justify-between md:hidden"
              >
                <div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg overflow-hidden border border-gray-200 shadow-xs bg-white shrink-0">
                        <img
                          src="/samruddhi-logo.jpeg"
                          alt={t("p2.ui.samruddhi_organics_logo_ytkuov")}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-extrabold tracking-tight text-gray-900 leading-tight">
                          NutriPalm <span className="text-primary font-bold">AI</span>
                        </span>
                        <span className="text-[7px] font-semibold text-gray-400 leading-none mt-0.5 tracking-wider">
                          {t("p2.ui.by_samruddhi_organics_1y0cqdj")}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-label={t("p2.nav.close_menu")}
                      className="min-h-11 min-w-11 p-1 text-gray-500 hover:text-gray-900 border-0 bg-transparent cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mb-6 flex justify-center">
                    <LanguageToggle />
                  </div>
                  {renderNav(false, () => setIsMobileMenuOpen(false))}
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onBackToLanding();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-all border-0 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>{t('app.landing_page')}</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-grow p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen + (isScreenLoading ? "-loading" : "-loaded")}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {isScreenLoading ? renderLoadingSkeleton() : renderActiveScreen()}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Toast Portal Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none select-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 50, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 260 }}
              className="pointer-events-auto w-80 bg-white/75 backdrop-blur-md border border-gray-200/50 shadow-lg rounded-2xl p-4 flex gap-3 items-start relative overflow-hidden"
            >
              {/* Left Color strip */}
              <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${toast.type === "success" ? "bg-emerald-500" :
                toast.type === "info" ? "bg-blue-500" : "bg-amber-500"
                }`} />

              <div className="flex-grow pl-2 text-left text-xs">
                <div className="flex justify-between items-start">
                  <span className="font-extrabold text-gray-900 leading-tight">
                    {toast.type === "success" ? t("p2.app.toast_success") :
                      toast.type === "info" ? t("p2.app.toast_info") : t("p2.app.toast_warning")}
                  </span>
                  <button
                    onClick={() => setToasts(prev => prev.filter(x => x.id !== toast.id))}
                    aria-label={t("p2.app.close")}
                    className="text-gray-500 hover:text-gray-900 cursor-pointer border-0 bg-transparent text-sm p-1 leading-none"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-500 mt-1 leading-normal">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>



    </div>
  );
};
