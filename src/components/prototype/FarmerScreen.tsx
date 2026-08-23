import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Filter, Plus, Eye, Edit, Trash2, 
  Map, Cpu, FileText, FlaskConical, Download, RefreshCw, X, User, 
  MapPin, Sprout, CheckCircle2, ChevronRight, Activity, Phone, Mail, Calendar, Info
} from "lucide-react";

export interface Farmer {
  id: string;
  name: string;
  village: string;
  district: string;
  contact: string;
  email: string;
  crop: string;
  area: number; // in acres
  joinDate: string;
  yield: string;
  soilHealth: number; // score 0-100
  lastInspection: string;
  status: "Active" | "Monitoring" | "Attention" | "Inactive";
  digitalTwin: "Online" | "Synced" | "Offline" | "Warning";
  lastRecommendation: string;
}

// Premium Animated Counter Component
const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
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

interface FarmerScreenProps {
  farmers: Farmer[];
  setFarmers?: React.Dispatch<React.SetStateAction<Farmer[]>>;
  onNavigate?: (screen: string) => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

export const FarmerScreen: React.FC<FarmerScreenProps> = ({
  farmers,
  setFarmers,
  onNavigate,
  showToast
}) => {
    const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [cropFilter, setCropFilter] = useState("All");
  const [districtFilter, setDistrictFilter] = useState("All");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Recently Added");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [addStep, setAddStep] = useState(1);
  
  // Local notification fallback if showToast isn't passed
  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  };

  // Multi-step modal states
  const [newFarmerData, setNewFarmerData] = useState({
    name: "",
    phone: "",
    email: "",
    village: "",
    district: "Dakshina Kannada",
    crop: "Oil Palm",
    farmSize: "",
    coordinates: "12.9141, 75.2612",
    soilType: "Loamy"
  });

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      triggerToast("Farmer database synchronized with telemetry nodes.", "success");
    }, 800);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setCropFilter("All");
    setDistrictFilter("All");
    setSizeFilter("All");
    setStatusFilter("All");
    setSortBy("Recently Added");
    triggerToast("Search filters cleared.", "info");
  };

  // Add Farmer Action
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmerData.name || !newFarmerData.phone || !newFarmerData.village) {
      triggerToast("Validation Failed: Please fill all required fields.", "warning");
      return;
    }

    if (setFarmers) {
      const added: Farmer = {
        id: `F-0${farmers.length + 1}`,
        name: newFarmerData.name,
        village: newFarmerData.village,
        district: newFarmerData.district,
        contact: newFarmerData.phone,
        email: newFarmerData.email || "demo.farmer@samruddhi.org",
        crop: newFarmerData.crop,
        area: parseFloat(newFarmerData.farmSize) || 5.0,
        joinDate: "July 2026",
        yield: "Pending Scan",
        soilHealth: 75,
        lastInspection: "Just registered",
        status: "Active",
        digitalTwin: "Online",
        lastRecommendation: "Initial scan queued"
      };

      setFarmers(prev => [added, ...prev]);
      triggerToast(`Farmer "${newFarmerData.name}" registered successfully.`, "success");
      setAddStep(3); // success view
    }
  };

  // Delete Action
  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (setFarmers) {
      setFarmers(prev => prev.filter(f => f.id !== id));
      triggerToast(`Farmer profile "${name}" deleted (Demo Sandbox mode).`, "warning");
      if (selectedFarmer?.id === id) {
        setSelectedFarmer(null);
      }
    }
  };

  // Filter and sort computation
  const filteredFarmers = farmers
    .filter((farmer) => {
      const matchesSearch =
        farmer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.crop.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCrop = cropFilter === "All" || farmer.crop === cropFilter;
      const matchesDistrict = districtFilter === "All" || farmer.district === districtFilter;
      const matchesStatus = statusFilter === "All" || farmer.status === statusFilter;
      
      let matchesSize = true;
      if (sizeFilter === "Small (<5 Ac)") matchesSize = farmer.area < 5;
      else if (sizeFilter === "Medium (5-10 Ac)") matchesSize = farmer.area >= 5 && farmer.area <= 10;
      else if (sizeFilter === "Large (>10 Ac)") matchesSize = farmer.area > 10;

      return matchesSearch && matchesCrop && matchesDistrict && matchesStatus && matchesSize;
    })
    .sort((a, b) => {
      if (sortBy === "Alphabetical") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "Farm Area") {
        return b.area - a.area;
      } else if (sortBy === "Latest Activity") {
        return a.lastInspection.localeCompare(b.lastInspection);
      }
      // "Recently Added" - default descending ID order
      return b.id.localeCompare(a.id);
    });

  // Unique elements for filter dropdowns
  const cropOptions = ["All", ...Array.from(new Set(farmers.map(f => f.crop)))];
  const districtOptions = ["All", ...Array.from(new Set(farmers.map(f => f.district)))];

  // Derived summaries for cards
  const totalArea = farmers.reduce((sum, f) => sum + f.area, 0);
  const avgArea = farmers.length ? totalArea / farmers.length : 0;
  const avgSoil = farmers.length ? farmers.reduce((sum, f) => sum + f.soilHealth, 0) / farmers.length : 0;
  const activeCount = farmers.filter(f => f.status === "Active").length;
  const monitoringCount = farmers.filter(f => f.status === "Monitoring").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      
      {/* ================= 1. Farmer Management Header ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            
                                  {t('farmerscreen.farmer_management')}
                                </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            
                                  {t('farmerscreen.manage_registered_farmers_monitor_farm_o')}
                                </p>
        </div>
        
        {/* Top Right Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setAddStep(1);
              setNewFarmerData({
                name: "",
                phone: "",
                email: "",
                village: "",
                district: "Dakshina Kannada",
                crop: "Oil Palm",
                farmSize: "",
                coordinates: "12.9141, 75.2612",
                soilType: "Loamy"
              });
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-xs cursor-pointer border-0"
          >
            <Plus className="w-4 h-4" />
            
                                  {t('farmerscreen.add_farmer')}
                                </button>
          
          <button
            onClick={() => triggerToast("Exporting database schema to CSV...", "info")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            
                                  {t('farmerscreen.export_data')}
                                </button>

          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center p-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
            title={t('farmerscreen.refresh_database')}
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Chips (Row directly below header) */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-650">
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <span>👨‍🌾</span>  {t('farmerscreen.total_farmers')} <strong className="text-primary font-black">{farmers.length}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <span>🌾</span>  {t('farmerscreen.total_farm_area')} <strong className="text-primary font-black">{totalArea.toFixed(1)}  {t('farmerscreen.acres')}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />  {t('farmerscreen.active_farmers')} <strong className="text-primary font-black">{activeCount}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <span>📄</span>  {t('farmerscreen.soil_reports_scanned')} <strong className="text-primary font-black">{farmers.length}</strong>
        </span>
      </div>

      {/* ================= 7. Farmer Summary Cards ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmerscreen.registered_farmers')}</p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              <AnimatedCounter value={farmers.length} />
            </h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/50">{t('farmerscreen.12_mom')}</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmerscreen.active_farms')}</p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              <AnimatedCounter value={activeCount + monitoringCount} />
            </h3>
            <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/50">{t('farmerscreen.100_calibrated')}</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmerscreen.average_farm_size')}</p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              <AnimatedCounter value={avgArea} decimals={1} suffix=" Ac" />
            </h3>
            <span className="text-[10px] font-bold text-gray-450 uppercase">{t('farmerscreen.region_average')}</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmerscreen.average_soil_health')}</p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              <AnimatedCounter value={avgSoil} suffix="%" />
            </h3>
            <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-150">{t('farmerscreen.optimal_range')}</span>
          </div>
        </div>

      </div>

      {/* ================= 2-COLUMN LAYOUT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Controls + Database Table (8/12 width) */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* ================= 2. Search & Filter Bar ================= */}
          <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-4">
            
            {/* Search inputs row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('farmerscreen.search_farmers_by_name_village_crop_or_f')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all font-semibold text-gray-800 placeholder-gray-400"
                />
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t('farmerscreen.sort_by')}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-bold focus:border-primary focus:outline-hidden cursor-pointer"
                >
                  <option>{t('farmerscreen.recently_added')}</option>
                  <option>{t('farmerscreen.alphabetical')}</option>
                  <option>{t('farmerscreen.farm_area')}</option>
                  <option>{t('farmerscreen.latest_activity')}</option>
                </select>
              </div>
            </div>

            {/* Filter selectors row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">
                  <Filter className="w-3.5 h-3.5 text-primary" />  {t('farmerscreen.filters')}
                                                  </div>

                {/* Crop filter */}
                <select
                  value={cropFilter}
                  onChange={(e) => setCropFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary cursor-pointer text-gray-700"
                >
                  {cropOptions.map((crop) => (
                    <option key={crop} value={crop}>{t('farmerscreen.crop')} {crop}</option>
                  ))}
                </select>

                {/* District filter */}
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary cursor-pointer text-gray-700"
                >
                  {districtOptions.map((dist) => (
                    <option key={dist} value={dist}>{t('farmerscreen.district')} {dist}</option>
                  ))}
                </select>

                {/* Farm Size filter */}
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary cursor-pointer text-gray-700"
                >
                  <option>{t('farmerscreen.all_sizes')}</option>
                  <option>{t('farmerscreen.small_lt_5_ac')}</option>
                  <option>{t('farmerscreen.medium_5_10_ac')}</option>
                  <option>{t('farmerscreen.large_gt_10_ac')}</option>
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary cursor-pointer text-gray-700"
                >
                  <option value="All">{t('farmerscreen.all_statuses')}</option>
                  <option value="Active">{t('farmerscreen.active')}</option>
                  <option value="Monitoring">{t('farmerscreen.monitoring')}</option>
                  <option value="Attention">{t('farmerscreen.attention')}</option>
                  <option value="Inactive">{t('farmerscreen.inactive')}</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(searchQuery || cropFilter !== "All" || districtFilter !== "All" || sizeFilter !== "All" || statusFilter !== "All") && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-extrabold text-red-600 hover:text-red-700 flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  
                                                    {t('farmerscreen.clear_filters')}
                                                  </button>
              )}
            </div>
          </div>

          {/* ================= 3. Farmers Data Table ================= */}
          <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs relative">
            
            {/* Loading skeletons overlays */}
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center animate-pulse">
                    <div className="w-9 h-9 bg-gray-100 rounded-full" />
                    <div className="flex-grow space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                      <div className="h-2 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="w-16 h-3 bg-gray-100 rounded" />
                    <div className="w-12 h-3 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredFarmers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-150 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <th className="p-4 pl-6">{t('farmerscreen.farmer_name')}</th>
                      <th className="p-4">{t('farmerscreen.farmer_id')}</th>
                      <th className="p-4">{t('farmerscreen.location')}</th>
                      <th className="p-4">{t('farmerscreen.primary_crop')}</th>
                      <th className="p-4">{t('farmerscreen.farm_area')}</th>
                      <th className="p-4">{t('farmerscreen.soil_health')}</th>
                      <th className="p-4">{t('farmerscreen.last_inspection')}</th>
                      <th className="p-4">{t('farmerscreen.status')}</th>
                      <th className="p-4 text-right pr-6">{t('farmerscreen.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-sans">
                    {filteredFarmers.map((farmer) => {

                      const initials = farmer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("");
                      
                      // Status Badge Styling
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          
                                                        {t('farmerscreen.active')}
                                                      </span>
                      );
                      if (farmer.status === "Monitoring") {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            
                                                            {t('farmerscreen.monitoring')}
                                                          </span>
                        );
                      } else if (farmer.status === "Attention") {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-100/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            
                                                            {t('farmerscreen.attention')}
                                                          </span>
                        );
                      } else if (farmer.status === "Inactive") {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            
                                                            {t('farmerscreen.inactive')}
                                                          </span>
                        );
                      }

                      return (
                        <motion.tr 
                          key={farmer.id} 
                          onClick={() => setSelectedFarmer(farmer)}
                          className="hover:bg-emerald-50/20 hover:scale-[1.002] transition-all duration-200 cursor-pointer"
                        >
                          {/* Name + Avatar */}
                          <td className="p-4 pl-6 font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-[#81C784] text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-gray-950 block hover:text-primary transition-colors">{farmer.name}</span>
                              <span className="text-[10px] text-gray-450 font-semibold block mt-0.5">{t('farmerscreen.joined')} {farmer.joinDate}</span>
                            </div>
                          </td>

                          {/* Farmer ID */}
                          <td className="p-4 font-mono font-bold text-gray-500">{farmer.id}</td>

                          {/* Village & District */}
                          <td className="p-4 font-semibold text-gray-700">
                            <span>{farmer.village}</span>
                            <span className="block text-[10px] text-gray-400 font-medium">{farmer.district}</span>
                          </td>

                          {/* Primary Crop */}
                          <td className="p-4">
                            <span className="font-bold text-gray-800">{farmer.crop}</span>
                          </td>

                          {/* Farm Area */}
                          <td className="p-4 font-bold text-gray-800">{farmer.area}  {t('farmerscreen.acres')}</td>

                          {/* Soil Health Score index */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                <div 
                                  className={`h-full ${
                                    farmer.soilHealth >= 80 ? "bg-primary" : farmer.soilHealth >= 60 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${farmer.soilHealth}%` }}
                                />
                              </div>
                              <span className="font-black text-gray-850">{farmer.soilHealth}%</span>
                            </div>
                          </td>

                          {/* Last Inspection */}
                          <td className="p-4 text-gray-500 font-medium">{farmer.lastInspection}</td>

                          {/* Status */}
                          <td className="p-4">{statusBadge}</td>

                          {/* Actions (Section 4 Quick Actions) */}
                          <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => setSelectedFarmer(farmer)}
                                title={t('farmerscreen.view_profile')}
                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                              >
                                <Eye className="w-4.5 h-4.5" />
                              </button>
                              
                              <button
                                onClick={() => triggerToast(`Edit functionality triggered for ${farmer.name}.`, "info")}
                                title={t('farmerscreen.edit_profile')}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                              >
                                <Edit className="w-4.5 h-4.5" />
                              </button>

                              <button
                                onClick={() => onNavigate && onNavigate("Farm Plots")}
                                title={t('farmerscreen.view_farm_plots')}
                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                              >
                                <Map className="w-4.5 h-4.5" />
                              </button>

                              <button
                                onClick={() => onNavigate && onNavigate("Digital Twin")}
                                title={t('farmerscreen.open_digital_twin')}
                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                              >
                                <Cpu className="w-4.5 h-4.5" />
                              </button>

                              <button
                                onClick={() => onNavigate && onNavigate("Recommendations")}
                                title={t('farmerscreen.generate_ai_recommendation')}
                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                              >
                                <FlaskConical className="w-4.5 h-4.5" />
                              </button>

                              <button
                                onClick={(e) => handleDelete(farmer.id, farmer.name, e)}
                                title={t('farmerscreen.delete_profile_demo_sandbox')}
                                className="p-1.5 text-gray-450 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ================= 9. Empty State ================= */
              <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-primary">
                  <User className="w-10 h-10" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-lg font-extrabold text-gray-800">{t('farmerscreen.no_farmers_registered')}</h3>
                  <p className="text-xs text-gray-500">
                    
                                                                  {t('farmerscreen.no_verified_landholder_profiles_match_th')}
                                                                </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-5 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all shadow-md shadow-primary/10 border-0 cursor-pointer"
                >
                  
                                                            {t('farmerscreen.register_first_farmer')}
                                                          </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Recent activity timeline sidebar (4/12 width) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* ================= 8. Recent Farmer Activity Timeline ================= */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs">
            <h3 className="font-extrabold text-gray-900 text-sm mb-6 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-primary" />
              
                                        {t('farmerscreen.agronomist_activity_logs')}
                                      </h3>
            
            <div className="relative pl-6 border-l border-gray-100 space-y-6 text-xs">
              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{t('farmerscreen.new_farmer_registered')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmerscreen.09_32_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmerscreen.rajesh_kumar_added_to_hassan_village')}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-indigo-500 shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{t('farmerscreen.farm_plot_added')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmerscreen.09_18_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmerscreen.swaminathan_gowda_mapped_plot_3b')}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-600 shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{t('farmerscreen.soil_report_uploaded')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmerscreen.08_54_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmerscreen.npk_diagnostic_pdf_scanned_for_f_02')}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-amber-500 shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{t('farmerscreen.digital_twin_updated')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmerscreen.08_40_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmerscreen.canopy_indexes_updated_for_plot_2a')}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-[#43A047] shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{t('farmerscreen.recommendation_generated')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmerscreen.yesterday')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmerscreen.slow_release_npk_a_generated_for_f_03')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Informational Tip Card */}
          <div className="bg-emerald-50/40 border border-emerald-500/10 rounded-3xl p-5 text-xs text-emerald-800 space-y-2">
            <span className="font-extrabold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary" />
              
                                        {t('farmerscreen.agronomy_crm_tip')}
                                      </span>
            <p className="leading-relaxed">
              
                                        {t('farmerscreen.verify_npk_diagnostic_scans_from_the_soi')}
                                      </p>
          </div>

        </div>

      </div>

      {/* ================= 5. Farmer Profile Sliding Drawer ================= */}
      <AnimatePresence>
        {selectedFarmer && (
          <>
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-xs pointer-events-auto"
              onClick={() => setSelectedFarmer(null)}
            />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] bg-white shadow-2xl border-l border-gray-150 p-6 md:p-8 flex flex-col justify-between overflow-y-auto text-left"
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-3 py-1 rounded-full">
                    
                                                          {t('farmerscreen.landholder_profile')}
                                                        </span>
                  <button
                    onClick={() => setSelectedFarmer(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors border-0 cursor-pointer bg-transparent"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile photo initials + Details */}
                <div className="flex items-center gap-4 border-b border-gray-100 pb-5 mb-5">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-[#81C784] text-white flex items-center justify-center font-black text-xl shadow-md">
                    {selectedFarmer.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900 leading-tight">{selectedFarmer.name}</h3>
                    <p className="text-xs font-mono font-bold text-gray-400 mt-1">{selectedFarmer.id}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">{t('farmerscreen.village')} {selectedFarmer.village}</p>
                  </div>
                </div>

                {/* Specs List */}
                <div className="space-y-4 text-xs font-semibold text-gray-700">
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />  {t('farmerscreen.phone')}</span>
                    <span className="text-gray-800 font-bold">{selectedFarmer.contact}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />  {t('farmerscreen.email')}</span>
                    <span className="text-gray-800 font-bold font-mono">{selectedFarmer.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />  {t('farmerscreen.district_1')}</span>
                    <span className="text-gray-800 font-bold">{selectedFarmer.district}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />  {t('farmerscreen.registered_since')}</span>
                    <span className="text-gray-850 font-bold">{selectedFarmer.joinDate}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><Sprout className="w-3.5 h-3.5" />  {t('farmerscreen.primary_crop')}</span>
                    <span className="text-primary font-bold">{selectedFarmer.crop}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><Map className="w-3.5 h-3.5" />  {t('farmerscreen.total_farm_area_1')}</span>
                    <span className="text-gray-800 font-bold">{selectedFarmer.area}  {t('farmerscreen.acres')}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />  {t('farmerscreen.recent_soil_score')}</span>
                    <span className="text-gray-800 font-bold">{selectedFarmer.soilHealth}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" />  {t('farmerscreen.digital_twin_status')}</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {selectedFarmer.digitalTwin}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2">
                    <span className="text-gray-400 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" />  {t('farmerscreen.last_ai_recommendation')}</span>
                    <p className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl text-gray-700 leading-normal font-medium">
                      {selectedFarmer.lastRecommendation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons (12. Navigation flow connecting other modules) */}
              <div className="space-y-2.5 pt-6 border-t border-gray-100">
                <button
                  onClick={() => {
                    setSelectedFarmer(null);
                    if (onNavigate) onNavigate("Farm Plots");
                  }}
                  className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
                >
                  <Map className="w-4 h-4" />
                  
                                                    {t('farmerscreen.view_farm_plots')}
                                                  </button>

                <button
                  onClick={() => {
                    setSelectedFarmer(null);
                    if (onNavigate) onNavigate("Digital Twin");
                  }}
                  className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cpu className="w-4 h-4 text-primary" />
                  
                                                    {t('farmerscreen.open_digital_twin')}
                                                  </button>

                <button
                  onClick={() => {
                    setSelectedFarmer(null);
                    if (onNavigate) onNavigate("Soil Reports");
                  }}
                  className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  
                                                    {t('farmerscreen.upload_soil_report')}
                                                  </button>

                <button
                  onClick={() => {
                    setSelectedFarmer(null);
                    if (onNavigate) onNavigate("Recommendations");
                  }}
                  className="w-full bg-indigo-550 hover:bg-indigo-650 text-white font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
                >
                  <FlaskConical className="w-4 h-4" />
                  
                                                    {t('farmerscreen.generate_ai_recommendation')}
                                                  </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================= 6. Add Farmer Multi-step Form Modal ================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
            {/* Backdrop shadow overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black pointer-events-auto"
              onClick={() => setIsAddModalOpen(false)}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] border-2 border-gray-200 shadow-2xl p-6 md:p-8 max-w-lg w-full relative z-10 text-left overflow-y-auto max-h-[90vh]"
            >
              
              {/* Close Button */}
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-6 right-6 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Progress Wizard headers */}
              <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-gray-100">
                <span className="text-[10px] font-black text-primary bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  
                                                    {t('farmerscreen.wizard_step')} {addStep}  {t('farmerscreen.of_3')}
                                                  </span>
                <span className="text-xs font-bold text-gray-400">
                  {addStep === 1 ? "Basic Details" : addStep === 2 ? "Farm Specs" : "Success"}
                </span>
              </div>

              {/* Success View */}
              {addStep === 3 ? (
                <div className="text-center py-6 space-y-5">
                  <div className="w-16 h-16 bg-emerald-50 text-primary rounded-full flex items-center justify-center mx-auto shadow-xs border border-emerald-100/50">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h3 className="text-lg font-black text-gray-900">{t('farmerscreen.farmer_registered_successfully')}</h3>
                    <p className="text-xs text-gray-500">
                      
                                                                {t('farmerscreen.the_landholder_profile_is_active_in_the_')}
                                                              </p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-xs border-0 cursor-pointer"
                  >
                    
                                                          {t('farmerscreen.done')}
                                                        </button>
                </div>
              ) : (
                <form onSubmit={handleAddSubmit} className="space-y-5">
                  
                  {/* Step 1: Basic Details */}
                  {addStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-1 bg-gray-50 p-3 rounded-2xl border border-gray-150 mb-2">
                        <h4 className="text-xs font-extrabold text-gray-800">{t('farmerscreen.basic_details')}</h4>
                        <p className="text-[11px] text-gray-450">{t('farmerscreen.please_fill_basic_personal_details_to_ve')}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.farmer_name_1')}</label>
                        <input
                          required
                          type="text"
                          value={newFarmerData.name}
                          onChange={(e) => setNewFarmerData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder={t('farmerscreen.e_g_swaminathan_gowda')}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.phone_number')}</label>
                          <input
                            required
                            type="tel"
                            value={newFarmerData.phone}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder={t('farmerscreen.e_g_91_94401_23456')}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.email_address')}</label>
                          <input
                            type="email"
                            value={newFarmerData.email}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder={t('farmerscreen.e_g_swamy_samruddhi_org')}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.village_1')}</label>
                          <input
                            required
                            type="text"
                            value={newFarmerData.village}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, village: e.target.value }))}
                            placeholder={t('farmerscreen.e_g_rangampeta')}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.district_1')}</label>
                          <select
                            value={newFarmerData.district}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, district: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                          >
                            <option>{t('farmerscreen.dakshina_kannada')}</option>
                            <option>{t('farmerscreen.hassan')}</option>
                            <option>{t('farmerscreen.bhadradri_kothagudem')}</option>
                            <option>{t('farmerscreen.chittoor')}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Farm Details */}
                  {addStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-1 bg-gray-50 p-3 rounded-2xl border border-gray-150 mb-2">
                        <h4 className="text-xs font-extrabold text-gray-800">{t('farmerscreen.farm_details')}</h4>
                        <p className="text-[11px] text-gray-450">{t('farmerscreen.please_set_crop_details_sizes_and_types')}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.primary_crop')}</label>
                          <select
                            value={newFarmerData.crop}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, crop: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                          >
                            <option>{t('farmerscreen.oil_palm')}</option>
                            <option>{t('farmerscreen.coconut_palm')}</option>
                            <option>{t('farmerscreen.cocoa')}</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.farm_size_acres')}</label>
                          <input
                            required
                            type="number"
                            step="0.1"
                            value={newFarmerData.farmSize}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, farmSize: e.target.value }))}
                            placeholder={t('farmerscreen.e_g_10_5')}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.gnss_coordinates')}</label>
                          <input
                            type="text"
                            value={newFarmerData.coordinates}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, coordinates: e.target.value }))}
                            placeholder="12.9141, 75.2612"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerscreen.soil_type')}</label>
                          <select
                            value={newFarmerData.soilType}
                            onChange={(e) => setNewFarmerData(prev => ({ ...prev, soilType: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                          >
                            <option>{t('farmerscreen.loamy')}</option>
                            <option>{t('farmerscreen.clay')}</option>
                            <option>{t('farmerscreen.sandy')}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Action Footer inside modal */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-150 mt-6">
                    {addStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer"
                      >
                        
                                                                          {t('farmerscreen.cancel')}
                                                                        </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddStep(1)}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1.5 bg-transparent border-0 cursor-pointer"
                      >
                        
                                                                              {t('farmerscreen.back')}
                                                                            </button>
                    )}

                    {addStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (newFarmerData.name && newFarmerData.phone && newFarmerData.village) {
                            setAddStep(2);
                          } else {
                            triggerToast("Validation Failed: Please fill Name, Phone, and Village.", "warning");
                          }
                        }}
                        className="px-5 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 border-0 cursor-pointer shadow-sm"
                      >
                        
                                                                          {t('farmerscreen.next_specs')}
                                                                          <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 border-0 cursor-pointer shadow-sm animate-pulse"
                      >
                        
                                                                              {t('farmerscreen.create_farmer')}
                                                                            </button>
                    )}
                  </div>

                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
