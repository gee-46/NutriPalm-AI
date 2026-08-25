import React, { useState, useEffect } from "react";
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
  ArrowLeft
} from "lucide-react";

import { DashboardScreen } from "./prototype/DashboardScreen";
import { FarmerScreen } from "./prototype/FarmerScreen";
import type { Farmer } from "./prototype/FarmerScreen";
import { AddFarmerScreen } from "./prototype/AddFarmerScreen";
import { FarmPlotScreen } from "./prototype/FarmPlotScreen";
import { DigitalTwinScreen } from "./prototype/DigitalTwinScreen";
import { SoilReportScreen } from "./prototype/SoilReportScreen";
import { RecommendationScreen } from "./prototype/RecommendationScreen";
import { AnalyticsScreen } from "./prototype/AnalyticsScreen";
import { SettingsScreen } from "./prototype/SettingsScreen";
import { NotFoundScreen } from "./prototype/NotFoundScreen";
import { 
  DashboardSkeleton, 
  FarmerTableSkeleton, 
  SoilReportSkeleton, 
  AnalyticsSkeleton, 
  GenericSkeleton 
} from "./prototype/LoadingSkeletons";
import { LanguageToggle } from "../translation/LanguageToggle";
import { useTranslation } from "../translation/useTranslation";

interface PrototypeAppProps {
  onBackToLanding: () => void;
}

const demoSteps = [
  {
    screen: "Dashboard",
    title: "Dashboard Control Panel",
    desc: "NutriPalm AI aggregates real-time agricultural vital stats, local weather forecasts, active operation logs, and AI observation metrics in a centralized SaaS dashboard.",
    highlightStyle: "top-[23%] right-[8%] sm:right-[15%] md:right-[20%]"
  },
  {
    screen: "Farmers",
    title: "Farmer Registry Database",
    desc: "Enables lead agronomists to list, search, village filter, and register new landholder profiles to coordinate custom agricultural advisory deployments.",
    highlightStyle: "top-[18%] right-[8%] sm:right-[15%] md:right-[20%]"
  },
  {
    screen: "Farm Plots",
    title: "GIS Plot Boundary Mapping",
    desc: "Leverages Sentinel-2 satellite coordinate mapping. Clicking on any custom plot instantly measures acreage, leaf NDVI health, and GNSS vertex node coordinates.",
    highlightStyle: "top-[32%] right-[8%] sm:right-[15%] md:right-[20%]"
  },
  {
    screen: "Digital Twin",
    title: "Biophysical Digital Twin Simulator",
    desc: "An isometric canopy twin model tracking chlorophyll reflectance and root moisture. Toggling drought sandboxes automatically recalibrates vital indices in real-time.",
    highlightStyle: "top-[28%] right-[8%] sm:right-[15%] md:right-[20%]"
  },
  {
    screen: "Soil Reports",
    title: "AI OCR Document Scanning",
    desc: "Agronomists upload diagnostic lab reports to trigger an OCR processing pipeline. Text extraction logs map Nitrogen, Phosphorus, Potassium, Carbon and pH levels.",
    highlightStyle: "top-[22%] right-[8%] sm:right-[15%] md:right-[20%]"
  },
  {
    screen: "Recommendations",
    title: "AI Slow-Release Formulations",
    desc: "Generates bespoke slow-release recipes (12-6-22 NPK). Calibrates seasonal timeline schedules, expected bunch weight gains (+18.2%), and environmental leaching risks.",
    highlightStyle: "top-[26%] right-[8%] sm:right-[15%] md:right-[20%]"
  },
  {
    screen: "Analytics",
    title: "Agronomic Analytical Trends",
    desc: "Aggregates historical soil recovery graphs, active fertilizer volumes applied, and doughnut charts tracking regional crop type distribution metrics.",
    highlightStyle: "top-[23%] right-[8%] sm:right-[15%] md:right-[20%]"
  }
];

export const PrototypeApp: React.FC<PrototypeAppProps> = ({ onBackToLanding }) => {
  const { t } = useTranslation();
  const [currentScreen, setCurrentScreen] = useState("Dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isScreenLoading, setIsScreenLoading] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onBackToLanding();
  };

  const changeScreen = (screenName: string) => {
    setIsScreenLoading(true);
    setCurrentScreen(screenName);
    setTimeout(() => {
      setIsScreenLoading(false);
    }, 600);
  };

  // Guided Walkthrough State
  const [demoState, setDemoState] = useState({ isActive: false, stepIndex: 0 });

  const startDemo = () => {
    setDemoState({ isActive: true, stepIndex: 0 });
    changeScreen("Dashboard");
  };

  const nextDemoStep = () => {
    if (demoState.stepIndex < demoSteps.length - 1) {
      const nextIdx = demoState.stepIndex + 1;
      setDemoState(prev => ({ ...prev, stepIndex: nextIdx }));
      changeScreen(demoSteps[nextIdx].screen);
    } else {
      exitDemo();
    }
  };

  const prevDemoStep = () => {
    if (demoState.stepIndex > 0) {
      const prevIdx = demoState.stepIndex - 1;
      setDemoState(prev => ({ ...prev, stepIndex: prevIdx }));
      changeScreen(demoSteps[prevIdx].screen);
    }
  };

  const exitDemo = () => {
    setDemoState({ isActive: false, stepIndex: 0 });
    changeScreen("Dashboard");
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Sentinel-2 satellite coordinates updated for Plot 2A.", read: false },
    { id: 2, text: "AI advisor completed Mix-B analysis.", read: false }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

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
  }, [currentScreen]);

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
    const name = currentUser?.user_metadata?.full_name || currentUser?.email || "LR";
    return name[0].toUpperCase();
  };

  const displayName = userProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email || "Dr. L. Ramana";
  const displayRole = userProfile?.user_role || "Agronomist";

  // Reusable Toast Notification System
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "info" | "warning" }>>([]);
  const showToast = (message: string, type: "success" | "info" | "warning" = "success") => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Shared state: pre-populated list of farmers with rich properties
  const [farmers, setFarmers] = useState<Farmer[]>([
    {
      id: "F-01",
      name: "Swaminathan Gowda",
      village: "Rangampeta",
      district: "Dakshina Kannada",
      contact: "+91 94401 23456",
      email: "swamy.g@gmail.com",
      crop: "Oil Palm",
      area: 12.5,
      joinDate: "June 2024",
      yield: "14.2 tons/ac",
      soilHealth: 88,
      lastInspection: "2 hours ago",
      status: "Active",
      digitalTwin: "Online",
      lastRecommendation: "NPK Mix-B"
    },
    {
      id: "F-02",
      name: "K. Ramachandra Rao",
      village: "Kothagudem",
      district: "Bhadradri Kothagudem",
      contact: "+91 98480 98765",
      email: "ramachandra.k@gmail.com",
      crop: "Oil Palm",
      area: 8.2,
      joinDate: "Sept 2024",
      yield: "13.0 tons/ac",
      soilHealth: 72,
      lastInspection: "5 hours ago",
      status: "Monitoring",
      digitalTwin: "Synced",
      lastRecommendation: "Potash supplement"
    },
    {
      id: "F-03",
      name: "M. Devamma",
      village: "Chittoor",
      district: "Chittoor",
      contact: "+91 99123 45678",
      email: "devamma.m@gmail.com",
      crop: "Coconut Palm",
      area: 5.0,
      joinDate: "Jan 2025",
      yield: "6.5 tons/ac",
      soilHealth: 55,
      lastInspection: "1 day ago",
      status: "Attention",
      digitalTwin: "Warning",
      lastRecommendation: "Slow-Release NPK-A"
    },
    {
      id: "F-04",
      name: "Rajesh Kumar",
      village: "Hassan",
      district: "Hassan",
      contact: "+91 94900 11223",
      email: "rajesh.k@gmail.com",
      crop: "Cocoa",
      area: 7.8,
      joinDate: "March 2025",
      yield: "2.1 tons/ac",
      soilHealth: 38,
      lastInspection: "2 days ago",
      status: "Inactive",
      digitalTwin: "Offline",
      lastRecommendation: "Emergency NPK dose"
    }
  ]);

  // Dashboard Stats derived from live data
  const [stats, setStats] = useState({
    totalFarmers: farmers.length,
    totalFarms: 6,
    activeTwins: 4,
    recommendations: 38,
    soilHealthScore: 78
  });

  // Add a farmer handler
  const handleAddFarmer = (newFarmer: Omit<Farmer, "id" | "joinDate">) => {
    const formatted: Farmer = {
      ...newFarmer,
      id: `F-0${farmers.length + 1}`,
      joinDate: "July 2026",
      yield: "Pending Scan"
    };
    setFarmers((prev) => [formatted, ...prev]);
    setStats((prev) => ({
      ...prev,
      totalFarmers: farmers.length + 1,
      totalFarms: prev.totalFarms + 1
    }));
    showToast(`Farmer "${formatted.name}" registered successfully.`, "success");
  };

  const handleSoilReportUploaded = () => {
    setStats((prev) => ({
      ...prev,
      recommendations: prev.recommendations + 1,
      soilHealthScore: 81 // mock score bump on clean diagnostics
    }));
    // Add a notification
    setNotifications((prev) => [
      { id: Date.now(), text: "New laboratory soil report successfully scanned.", read: false },
      ...prev
    ]);
    showToast("Soil report PDF uploaded & chemical levels extracted.", "success");
  };

  // Navigations mapping
  const sidebarItems = [
    { name: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: "Farmers", icon: <Users className="w-5 h-5" /> },
    { name: "Farm Plots", icon: <Map className="w-5 h-5" /> },
    { name: "Digital Twin", icon: <Cpu className="w-5 h-5" /> },
    { name: "Soil Reports", icon: <FileText className="w-5 h-5" /> },
    { name: "Recommendations", icon: <FlaskConical className="w-5 h-5" /> },
    { name: "Analytics", icon: <BarChart3 className="w-5 h-5" /> },
    { name: "Settings", icon: <Settings className="w-5 h-5" /> },
    { name: "Profile", icon: <User className="w-5 h-5" /> }
  ];

  const renderLoadingSkeleton = () => {
    switch (currentScreen) {
      case "Dashboard":
        return <DashboardSkeleton />;
      case "Farmers":
      case "Add Farmer":
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
        return <DashboardScreen stats={stats} onNavigate={changeScreen} onStartDemo={startDemo} />;
      case "Farmers":
        return (
          <FarmerScreen
            farmers={farmers}
            setFarmers={setFarmers}
            onNavigate={changeScreen}
            showToast={showToast}
          />
        );
      case "Add Farmer":
        return (
          <AddFarmerScreen
            onSave={handleAddFarmer}
            onCancel={() => changeScreen("Farmers")}
          />
        );
      case "Farm Plots":
        return (
          <FarmPlotScreen 
            onPlotCreated={() => showToast("New GIS boundary registered for Plot 3B.", "success")}
            onSync={() => showToast("Satellite GPS coordinates synchronized.", "info")}
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
            onRecommendationClick={() => changeScreen("Recommendations")}
            onUploadSuccess={handleSoilReportUploaded}
            showToast={showToast}
          />
        );
      case "Recommendations":
        return (
          <RecommendationScreen 
            onLoad={() => showToast("Slow-release NPK formulation compiled for Plot 2A.", "success")}
          />
        );
      case "Analytics":
        return <AnalyticsScreen />;
      case "Settings":
        return (
          <SettingsScreen 
            activeSection="Theme" 
            onSaveSuccess={() => showToast("System configuration profiles saved successfully.", "success")}
          />
        );
      case "Profile":
        return (
          <SettingsScreen 
            activeSection="Profile" 
            onSaveSuccess={() => showToast("Lead agronomist profile settings saved successfully.", "success")}
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
                alt="Samruddhi Organics Logo"
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
                  by Samruddhi Organics
                </span>
              </motion.div>
            )}
          </div>

          {/* Sidebar Nav Items */}
          <nav className="px-3 space-y-1 text-left">
            {sidebarItems.map((item) => {
              const isSelected = currentScreen === item.name || 
                (item.name === "Settings" && currentScreen === "Settings") ||
                (item.name === "Profile" && currentScreen === "Profile");
              return (
                <button
                  key={item.name}
                  onClick={() => changeScreen(item.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-0 cursor-pointer ${
                    isSelected
                      ? "bg-primary text-white shadow-md shadow-primary/10"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {item.icon}
                  {!isSidebarCollapsed && <span>{t(`sidebar.${item.name}`)}</span>}
                </button>
              );
            })}
          </nav>
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
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 text-[10px] font-bold text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              SYSTEM ONLINE
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsRead();
                }}
                className="p-2.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition-all relative border border-gray-200 cursor-pointer bg-white"
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
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[8px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">New alerts</span>
                      )}
                    </div>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className="text-xs border-b border-gray-50 pb-2">
                          <p className="text-gray-700 leading-tight">{n.text}</p>
                          <span className="block text-[8px] text-gray-400 mt-1 font-mono">Telemetry sync alert</span>
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
                          alt="Samruddhi Organics Logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-extrabold tracking-tight text-gray-900 leading-tight">
                          NutriPalm <span className="text-primary font-bold">AI</span>
                        </span>
                        <span className="text-[7px] font-semibold text-gray-400 leading-none mt-0.5 tracking-wider">
                          by Samruddhi Organics
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-1 text-gray-500 hover:text-gray-900 border-0 bg-transparent cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mb-6 flex justify-center">
                    <LanguageToggle />
                  </div>
                  <nav className="space-y-1 text-left">
                    {sidebarItems.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => {
                          changeScreen(item.name);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-0 cursor-pointer ${
                          currentScreen === item.name
                            ? "bg-primary text-white"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {item.icon}
                        <span>{t(`sidebar.${item.name}`)}</span>
                      </button>
                    ))}
                  </nav>
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
              <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                toast.type === "success" ? "bg-emerald-500" :
                toast.type === "info" ? "bg-blue-500" : "bg-amber-500"
              }`} />
              
              <div className="flex-grow pl-2 text-left text-xs">
                <div className="flex justify-between items-start">
                  <span className="font-extrabold text-gray-900 leading-tight">
                    {toast.type === "success" ? "Success Notification" :
                     toast.type === "info" ? "Telemetry Sync" : "System Alert"}
                  </span>
                  <button 
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-gray-400 hover:text-gray-650 cursor-pointer border-0 bg-transparent text-[10px] p-0 leading-none"
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

      {/* Guided Walkthrough Tooltip Overlay */}
      <AnimatePresence>
        {demoState.isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed z-40 w-72 bg-slate-950/95 backdrop-blur-md border border-indigo-500/30 p-5 rounded-2xl shadow-2xl text-white pointer-events-auto ${demoSteps[demoState.stepIndex].highlightStyle}`}
          >
            {/* Pulsing focal glow ring */}
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-indigo-400 rounded-full" />

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-indigo-400 uppercase tracking-widest">
                <span>GUIDED DEMO • STEP {demoState.stepIndex + 1} OF {demoSteps.length}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              </div>
              <h4 className="font-extrabold text-sm text-white leading-tight">
                {demoSteps[demoState.stepIndex].title}
              </h4>
              <p className="text-[10.5px] text-slate-300 leading-relaxed font-medium">
                {demoSteps[demoState.stepIndex].desc}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guided Walkthrough Bottom Console Controls */}
      <AnimatePresence>
        {demoState.isActive && (
          <motion.div
            initial={{ opacity: 0, y: 55 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 55 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-6 pointer-events-none"
          >
            <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md border border-slate-800 shadow-2xl rounded-2xl p-4.5 flex flex-col sm:flex-row justify-between items-center gap-4 text-white">
              <div className="text-left">
                <span className="text-[8.5px] font-mono text-indigo-400 uppercase tracking-widest block font-bold">NutriPalm AI Investor Guided Tour</span>
                <span className="text-xs font-extrabold block mt-1">Active Screen: {demoSteps[demoState.stepIndex].screen}</span>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={prevDemoStep}
                  disabled={demoState.stepIndex === 0}
                  className="flex-1 sm:flex-initial bg-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] px-4.5 py-2.5 rounded-xl transition-all cursor-pointer border-0"
                >
                  Previous
                </button>
                <button
                  onClick={nextDemoStep}
                  className="flex-1 sm:flex-initial bg-primary hover:bg-[#235F26] text-white font-bold text-[10px] px-5 py-2.5 rounded-xl transition-all cursor-pointer border-0 shadow-md shadow-primary/10"
                >
                  {demoState.stepIndex === demoSteps.length - 1 ? "Finish Tour" : "Next"}
                </button>
                <button
                  onClick={exitDemo}
                  className="flex-1 sm:flex-initial bg-rose-650 hover:bg-rose-700 text-white font-bold text-[10px] px-4.5 py-2.5 rounded-xl transition-all cursor-pointer border-0"
                >
                  Exit Demo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
