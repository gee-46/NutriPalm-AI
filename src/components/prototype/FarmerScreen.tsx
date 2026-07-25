import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Plus, ArrowUpDown, Eye, Edit, UserCheck } from "lucide-react";

export interface Farmer {
  id: string;
  name: string;
  village: string;
  contact: string;
  crop: string;
  area: number; // in acres
  joinDate: string;
  yield: string;
}

interface FarmerScreenProps {
  farmers: Farmer[];
  onAddFarmerClick: () => void;
  onViewProfileClick: (farmer: Farmer) => void;
}

export const FarmerScreen: React.FC<FarmerScreenProps> = ({
  farmers,
  onAddFarmerClick,
  onViewProfileClick
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [cropFilter, setCropFilter] = useState("All");
  const [villageFilter, setVillageFilter] = useState("All");
  const [sortField, setSortField] = useState<"name" | "area">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Get unique crops and villages for filtering
  const uniqueCrops = ["All", ...Array.from(new Set(farmers.map((f) => f.crop)))];
  const uniqueVillages = ["All", ...Array.from(new Set(farmers.map((f) => f.village)))];

  const handleSort = (field: "name" | "area") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter and sort farmers
  const filteredFarmers = farmers
    .filter((farmer) => {
      const matchesSearch =
        farmer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.contact.includes(searchQuery);

      const matchesCrop = cropFilter === "All" || farmer.crop === cropFilter;
      const matchesVillage = villageFilter === "All" || farmer.village === villageFilter;

      return matchesSearch && matchesCrop && matchesVillage;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "area") {
        comparison = a.area - b.area;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Farmer Database</h1>
          <p className="text-sm text-gray-500">Manage verified landholders and crop cultivation profiles</p>
        </div>
        <button
          onClick={onAddFarmerClick}
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-[#235F26] text-white font-bold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Farmer
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, village, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>
          
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-medium focus:border-primary focus:outline-hidden cursor-pointer"
          >
            {uniqueCrops.map((crop) => (
              <option key={crop} value={crop}>
                Crop: {crop}
              </option>
            ))}
          </select>

          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-250 bg-white text-xs font-medium focus:border-primary focus:outline-hidden cursor-pointer"
          >
            {uniqueVillages.map((village) => (
              <option key={village} value={village}>
                Village: {village}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-150 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-4 pl-6">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 hover:text-gray-800 font-bold bg-transparent border-0 cursor-pointer"
                  >
                    Farmer Name
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="p-4">Village</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Active Crop</th>
                <th className="p-4">
                  <button
                    onClick={() => handleSort("area")}
                    className="flex items-center gap-1 hover:text-gray-800 font-bold bg-transparent border-0 cursor-pointer"
                  >
                    Land Area
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {filteredFarmers.length > 0 ? (
                filteredFarmers.map((farmer) => (
                  <tr key={farmer.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-gray-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-primary flex items-center justify-center font-bold text-xs">
                        {farmer.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <span>{farmer.name}</span>
                        <span className="block text-[10px] text-gray-400 font-medium">Joined {farmer.joinDate}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-600">{farmer.village}</td>
                    <td className="p-4 text-xs font-mono text-gray-500">{farmer.contact}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-primary border border-emerald-100/50">
                        {farmer.crop}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-800">{farmer.area} Acres</td>
                    <td className="p-4 text-right pr-6">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => onViewProfileClick(farmer)}
                          title="View Profile"
                          className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit Farmer"
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck className="w-8 h-8 text-gray-300" />
                      <p className="text-sm font-semibold">No farmers match the current filter criteria</p>
                      <p className="text-xs">Try resetting filters or adjusting search queries</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
