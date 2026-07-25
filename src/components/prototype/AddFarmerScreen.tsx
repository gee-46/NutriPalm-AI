import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Layers, MapPin, Sprout, ArrowLeft, ArrowRight, Save, CheckCircle } from "lucide-react";
import type { Farmer } from "./FarmerScreen";

interface AddFarmerScreenProps {
  onSave: (farmer: Omit<Farmer, "id" | "joinDate">) => void;
  onCancel: () => void;
}

export const AddFarmerScreen: React.FC<AddFarmerScreenProps> = ({ onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [isSaved, setIsSaved] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    village: "",
    contact: "",
    email: "",
    farmName: "",
    area: "",
    soilType: "Loamy",
    waterSource: "Drip Irrigation",
    latitude: "17.3850",
    longitude: "78.4867",
    district: "Chittoor",
    state: "Andhra Pradesh",
    crop: "Oil Palm",
    variety: "Tenera Hybrid",
    treeAge: "",
    plantingDensity: "57" // Standard density for oil palm
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name || "Unnamed Farmer",
      village: formData.village || "Unknown Village",
      contact: formData.contact || "+91 99999 99999",
      crop: formData.crop,
      area: parseFloat(formData.area) || 5.0,
      yield: "Pending Scan"
    });
    setIsSaved(true);
  };

  const stepsInfo = [
    { num: 1, label: "Personal", icon: <User className="w-4 h-4" /> },
    { num: 2, label: "Farm Spec", icon: <Layers className="w-4 h-4" /> },
    { num: 3, label: "Location", icon: <MapPin className="w-4 h-4" /> },
    { num: 4, label: "Crop Details", icon: <Sprout className="w-4 h-4" /> }
  ];

  // Motion animation presets
  const slideVariants = {
    initial: (dir: number) => ({ opacity: 0, x: dir > 0 ? 50 : -50 }),
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -50 : 50, transition: { duration: 0.2 } })
  };

  const [dir, setDir] = useState(1);

  const setStepWithDir = (nextStep: number) => {
    setDir(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  if (isSaved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto bg-white rounded-3xl border border-gray-150 p-8 text-center shadow-xs mt-10"
      >
        <div className="w-16 h-16 bg-emerald-50 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Farmer Profile Created Successfully</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
          The landholder database and spatial map overlay are active. Digital twin calibration will start automatically in 24 hours.
        </p>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-[#235F26] text-white font-bold rounded-xl active:scale-95 shadow-md shadow-primary/10 transition-all text-sm cursor-pointer"
        >
          Return to Database
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Back Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer bg-transparent border-0"
        >
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>
        <span className="text-xs text-gray-400 font-bold">Step {step} of 4</span>
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Register New Farmer</h1>
        <p className="text-sm text-gray-500 mt-1">Enroll farmer profiles into the Samruddhi Twin index</p>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs flex justify-between items-center relative overflow-hidden">
        <div className="absolute left-10 right-10 top-[37px] h-0.5 bg-gray-100 -z-10" />
        <div
          className="absolute left-10 top-[37px] h-0.5 bg-primary -z-10 transition-all duration-300"
          style={{ width: `${((step - 1) / 3) * 80}%` }}
        />

        {stepsInfo.map((s) => {
          const isActive = step >= s.num;
          const isCurrent = step === s.num;
          return (
            <button
              key={s.num}
              onClick={() => {
                // simple validation limit: only allow clicking steps below or current
                if (s.num < step || (formData.name && formData.village)) {
                  setStepWithDir(s.num);
                }
              }}
              className="flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer focus:outline-hidden"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all ${
                  isCurrent
                    ? "bg-primary border-primary text-white scale-110 shadow-md shadow-primary/20"
                    : isActive
                    ? "bg-emerald-50 border-primary text-primary"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                {s.icon}
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight uppercase ${
                  isCurrent ? "text-primary" : isActive ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Wizard Content Form Panel */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden">
        <div className="p-6 md:p-8 min-h-[280px] relative">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={dir}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 text-sm mb-4 border-b border-gray-100 pb-2">Personal Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Farmer Name *</label>
                    <input
                      required
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Swaminathan Gowda"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Contact Number *</label>
                    <input
                      required
                      type="tel"
                      name="contact"
                      value={formData.contact}
                      onChange={handleChange}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Village *</label>
                    <input
                      required
                      type="text"
                      name="village"
                      value={formData.village}
                      onChange={handleChange}
                      placeholder="e.g. Hassan"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Email Address (Optional)</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. swami@samruddhi.org"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={dir}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 text-sm mb-4 border-b border-gray-100 pb-2">Farm Specifications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Farm Name / Identifier</label>
                    <input
                      type="text"
                      name="farmName"
                      value={formData.farmName}
                      onChange={handleChange}
                      placeholder="e.g. Swamy North Plot"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Total Farm Size (Acres) *</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      name="area"
                      value={formData.area}
                      onChange={handleChange}
                      placeholder="e.g. 7.5"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Soil Texture / Profile</label>
                    <select
                      name="soilType"
                      value={formData.soilType}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-white text-sm focus:border-primary focus:outline-hidden transition-colors cursor-pointer"
                    >
                      <option value="Loamy">Loamy Soil (Ideal)</option>
                      <option value="Clayey">Clayey Red Soil</option>
                      <option value="Sandy">Sandy Clay</option>
                      <option value="Laterite">Laterite Soil</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Irrigation infrastructure</label>
                    <select
                      name="waterSource"
                      value={formData.waterSource}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-white text-sm focus:border-primary focus:outline-hidden transition-colors cursor-pointer"
                    >
                      <option value="Drip Irrigation">Precision Drip</option>
                      <option value="Sprinklers">Micro Sprinklers</option>
                      <option value="Canal Feed">Canal / Surface Feed</option>
                      <option value="Rainfed">Monsoon Dependent (Rainfed)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={dir}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 text-sm mb-4 border-b border-gray-100 pb-2">GPS Location Boundaries</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">GPS Latitude *</label>
                    <input
                      required
                      type="text"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      placeholder="e.g. 17.3850"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">GPS Longitude *</label>
                    <input
                      required
                      type="text"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      placeholder="e.g. 78.4867"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">District</label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">State / Region</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 text-[10px] text-primary font-medium text-left">
                  Note: Latitude/Longitude coordinates are automatically matched with Sentinel-2 satellite grids for real-time NDVI NDVI calibration.
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                custom={dir}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 text-sm mb-4 border-b border-gray-100 pb-2">Crop Cultivation Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Cultivated Crop *</label>
                    <select
                      name="crop"
                      value={formData.crop}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-white text-sm focus:border-primary focus:outline-hidden transition-colors cursor-pointer"
                    >
                      <option value="Oil Palm">Oil Palm (Standard)</option>
                      <option value="Coconut">Coconut Palm</option>
                      <option value="Cocoa">Cocoa Plantation</option>
                      <option value="Coffee">Robusta/Arabica Coffee</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Variety / Cultivar</label>
                    <input
                      type="text"
                      name="variety"
                      value={formData.variety}
                      onChange={handleChange}
                      placeholder="e.g. Tenera DxP"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Average Tree/Plant Age (Years) *</label>
                    <input
                      required
                      type="number"
                      name="treeAge"
                      value={formData.treeAge}
                      onChange={handleChange}
                      placeholder="e.g. 5"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-gray-600">Planting Density (Plants/Acre)</label>
                    <input
                      type="number"
                      name="plantingDensity"
                      value={formData.plantingDensity}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-sm focus:border-primary focus:outline-hidden transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={handleBack}
            className={`inline-flex items-center gap-1 text-xs font-bold px-4 py-2.5 rounded-lg border border-gray-250 bg-white hover:bg-gray-50 transition-all cursor-pointer ${
              step === 1 ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Previous
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={
                step === 1 && (!formData.name || !formData.contact || !formData.village)
              }
              className="inline-flex items-center gap-1 text-xs font-bold text-white bg-primary hover:bg-[#235F26] px-5 py-2.5 rounded-lg active:scale-95 shadow-md shadow-primary/10 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-[#235F26] px-6 py-2.5 rounded-lg active:scale-95 shadow-md shadow-primary/10 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Farmer Profile
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
