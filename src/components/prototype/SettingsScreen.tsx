import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sun, Bell, Globe, Building, Check, Save } from "lucide-react";

interface SettingsScreenProps {
  activeSection?: string;
  onSaveSuccess?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ activeSection, onSaveSuccess }) => {
  const [activeTab, setActiveTab] = useState(activeSection || "Profile");
  const [isSaved, setIsSaved] = useState(false);

  // Profile data
  const [profile, setProfile] = useState({
    name: "Dr. L. Ramana",
    role: "Lead Agronomist",
    email: "ramana@samruddhi.org",
    phone: "+91 94401 98765",
    hub: "Chittoor Regional Hub"
  });

  // Toggles
  const [notifications, setNotifications] = useState({
    moistureDips: true,
    satelliteSync: true,
    fertilizerAlerts: false
  });

  // Selected language
  const [language, setLanguage] = useState("Telugu");

  // Selected theme
  const [theme, setTheme] = useState("Green Mesh");

  // Organization data
  const [org, setOrg] = useState({
    name: "Samruddhi Organics",
    dept: "Soil Science & Precision Telemetry",
    license: "NP-2026-X81-A93"
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    if (onSaveSuccess) onSaveSuccess();
    setTimeout(() => setIsSaved(false), 2000);
  };

  const tabs = [
    { id: "Profile", label: "Profile Settings", icon: <User className="w-4 h-4" /> },
    { id: "Theme", label: "UI Theme", icon: <Sun className="w-4 h-4" /> },
    { id: "Notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "Language", label: "Language", icon: <Globe className="w-4 h-4" /> },
    { id: "Organization", label: "Organization", icon: <Building className="w-4 h-4" /> }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Settings</h1>
        <p className="text-sm text-gray-500">Configure personal agronomist profiles and telemetry preferences</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-150 shadow-xs flex flex-col md:flex-row overflow-hidden min-h-[440px]">
        {/* Left Settings Navigation Tabs */}
        <div className="w-full md:w-60 bg-gray-50 border-r border-gray-150 p-4 space-y-1">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                  isSelected
                    ? "bg-primary text-white shadow-md shadow-primary/15"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-150"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Settings Content Form panel */}
        <div className="flex-1 p-6 md:p-8">
          <form onSubmit={handleSave} className="space-y-6 max-w-lg h-full flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {activeTab === "Profile" && (
                <motion.div
                  key="profile-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="font-extrabold text-gray-900 text-sm border-b border-gray-100 pb-2">Profile Information</h3>
                  
                  {/* Avatar Picker */}
                  <div className="flex items-center gap-4 py-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-primary text-primary flex items-center justify-center font-extrabold text-lg shadow-xs">
                      LR
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">Profile Photograph</p>
                      <p className="text-[10px] text-gray-400">JPG, PNG or WEBP. Max 2MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Full Name</label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Professional Role</label>
                      <input
                        type="text"
                        value={profile.role}
                        onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Primary Contact Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Contact Number</label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Assigned Regional Hub</label>
                    <input
                      type="text"
                      value={profile.hub}
                      onChange={(e) => setProfile({ ...profile, hub: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === "Theme" && (
                <motion.div
                  key="theme-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="font-extrabold text-gray-900 text-sm border-b border-gray-100 pb-2">UI Theme Select</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option 1: Green Mesh */}
                    <div
                      onClick={() => setTheme("Green Mesh")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        theme === "Green Mesh" ? "border-primary bg-emerald-50/20" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-800">Green Mesh (Default)</span>
                        {theme === "Green Mesh" && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-[10px] text-gray-400">NutriPalm agricultural trademark design layout</p>
                    </div>

                    {/* Option 2: Dark Forest */}
                    <div
                      onClick={() => setTheme("Dark Forest")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        theme === "Dark Forest" ? "border-primary bg-emerald-50/20" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-800">Dark Forest Mode</span>
                        {theme === "Dark Forest" && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-[10px] text-gray-400">High contrast dark theme for field tablets</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "Notifications" && (
                <motion.div
                  key="notifications-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="font-extrabold text-gray-900 text-sm border-b border-gray-100 pb-2">Telemetry Warnings</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-1">
                      <div>
                        <p className="text-xs font-bold text-gray-800">Soil Moisture Spikes</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Send SMS warning if water content drops below 30%</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, moistureDips: !notifications.moistureDips })}
                        className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer border-0 ${
                          notifications.moistureDips ? "bg-primary flex justify-end" : "bg-gray-200 flex justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 bg-white rounded-full block shadow-xs" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <div>
                        <p className="text-xs font-bold text-gray-800">Sentinel-2 Scan Completed</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Notify when biweekly NDVI vegetation map updates</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, satelliteSync: !notifications.satelliteSync })}
                        className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer border-0 ${
                          notifications.satelliteSync ? "bg-primary flex justify-end" : "bg-gray-200 flex justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 bg-white rounded-full block shadow-xs" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <div>
                        <p className="text-xs font-bold text-gray-800">AI Prescription Overrides</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Request manual check if weather forecasts shift significantly</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, fertilizerAlerts: !notifications.fertilizerAlerts })}
                        className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer border-0 ${
                          notifications.fertilizerAlerts ? "bg-primary flex justify-end" : "bg-gray-200 flex justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 bg-white rounded-full block shadow-xs" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "Language" && (
                <motion.div
                  key="language-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="font-extrabold text-gray-900 text-sm border-b border-gray-100 pb-2">Language Preferences</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">Select Local Language Override</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-medium focus:border-primary focus:outline-hidden transition-all cursor-pointer"
                    >
                      <option value="English">English (Global)</option>
                      <option value="Telugu">Telugu (Regional Andhra/TS)</option>
                      <option value="Kannada">Kannada (Regional Karnataka)</option>
                      <option value="Bahasa">Bahasa Indonesia (Sumatra/Kalimantan)</option>
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">This translates farmer report prints and SMS alerts into local dialects.</p>
                  </div>
                </motion.div>
              )}

              {activeTab === "Organization" && (
                <motion.div
                  key="org-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="font-extrabold text-gray-900 text-sm border-b border-gray-100 pb-2">Organization & Licensing</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Corporate Entity Name</label>
                      <input
                        type="text"
                        value={org.name}
                        onChange={(e) => setOrg({ ...org, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Department Segment</label>
                      <input
                        type="text"
                        value={org.dept}
                        onChange={(e) => setOrg({ ...org, dept: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 focus:bg-white text-xs focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">SaaS License Key</label>
                      <input
                        type="text"
                        readOnly
                        value={org.license}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-100 text-xs font-mono select-all cursor-not-allowed focus:outline-hidden"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Actions */}
            <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-primary hover:bg-[#235F26] text-white font-bold rounded-xl active:scale-95 shadow-md shadow-primary/10 transition-all text-xs cursor-pointer border-0"
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 animate-bounce" /> Changes Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};
