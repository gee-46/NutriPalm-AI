import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, 
  FileText, 
  AlertTriangle, 
  ArrowRight, 
  Activity, 
  Sparkles, 
  ShieldAlert, 
  Check, 
  HelpCircle 
} from "lucide-react";

interface SoilReportScreenProps {
  onRecommendationClick: () => void;
  onUploadSuccess: (nutrients: {
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    carbon: number;
    ph: number;
  }) => void;
}

type ScreenStage = "upload" | "processing" | "results";

export const SoilReportScreen: React.FC<SoilReportScreenProps> = ({
  onRecommendationClick,
  onUploadSuccess
}) => {
  const [stage, setStage] = useState<ScreenStage>("upload");
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  
  // Processing stages
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<"scan" | "ocr" | "correlation" | "finalize">("scan");
  const [logs, setLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  const processingSteps = [
    { key: "scan", label: "Scanning Document Structure", pct: 25 },
    { key: "ocr", label: "Extracting Chemical Nutrients via OCR", pct: 50 },
    { key: "correlation", label: "Running Agronomic Baseline Correlation", pct: 75 },
    { key: "finalize", label: "Finalizing Crop advisory models", pct: 100 }
  ];

  const logDatabase = [
    "Initializing slow-reading PDF engine...",
    "Locating document metadata boundaries...",
    "Document classified as: Hassan Labs Soil Diagnostic Report v2.0",
    "Running Optical Character Recognition (OCR)...",
    "Extracted: Nitrogen = 135 mg/kg (V0.81 confidence)",
    "Extracted: Phosphorus = 24 mg/kg (V0.85 confidence)",
    "Extracted: Potassium = 160 mg/kg (V0.92 confidence)",
    "Extracted: Organic Carbon = 1.82% (V0.78 confidence)",
    "Extracted: Soil pH Index = 5.85 (V0.99 confidence)",
    "Cross-referencing telemetry with Sentinel-2 vegetation canopy index...",
    "Mapping Plot Hassan-3A historical potassium trends...",
    "Generating customslow-release NPK Ratio recommendations...",
    "Soil health extraction complete. Loading diagnostic board."
  ];

  // Auto-scroll the logger terminal
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Handle mock file upload
  const handleUpload = () => {
    setFile({ name: "SAMRUDDHI_LABS_EAST_PLOT_3A.pdf", size: "1.4 MB" });
    setStage("processing");
    setProgress(0);
    setLogs(["[SYSTEM] Upload received."]);
  };

  // Manage process automation
  useEffect(() => {
    if (stage !== "processing") return;

    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logDatabase.length) {
        setLogs(prev => [...prev, `[INFO] ${logDatabase[logIndex]}`]);
        logIndex++;
      }
    }, 450);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 1;
        
        // Update active processing sub-steps
        if (next < 25) setCurrentStep("scan");
        else if (next < 50) setCurrentStep("ocr");
        else if (next < 75) setCurrentStep("correlation");
        else setCurrentStep("finalize");

        if (next >= 100) {
          clearInterval(progressInterval);
          clearInterval(logInterval);
          setTimeout(() => {
            onUploadSuccess({
              nitrogen: 135,
              phosphorus: 24,
              potassium: 160,
              carbon: 1.82,
              ph: 5.85
            });
            setStage("results");
          }, 800);
          return 100;
        }
        return next;
      });
    }, 60);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [stage]);

  const resetScanner = () => {
    setFile(null);
    setProgress(0);
    setLogs([]);
    setStage("upload");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">AI Soil Report Diagnostic</h1>
          <p className="text-sm text-gray-500 mt-1">Upload lab soil reports to extract telemetry indices and generate NPK formulas</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* Stage 1: Upload Panel */}
        {stage === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-white rounded-3xl border border-gray-150 p-8 shadow-xs text-center space-y-6">
              
              {/* Drag and Drop Zone */}
              <div
                onClick={handleUpload}
                className="border-2 border-dashed border-gray-250 hover:border-primary/50 bg-gray-50/50 hover:bg-emerald-50/10 rounded-2xl p-10 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-4"
              >
                <div className="p-4 bg-primary/5 text-primary rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Drag & drop soil report PDF here</p>
                  <p className="text-xs text-gray-400 mt-1.5">Supports standard lab reports up to 10MB</p>
                </div>
                <span className="text-[10px] font-bold text-primary px-3 py-1 bg-emerald-50 rounded-lg group-hover:bg-emerald-100/50 transition-colors">
                  Browse Files
                </span>
              </div>

              {/* Demo Sandbox Quick Link */}
              <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-800 text-left">
                <div className="flex gap-2.5 items-start">
                  <FileText className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">Don't have a report PDF handy?</p>
                    <p className="text-[11px] text-indigo-700/80 mt-1">
                      Click below to load a realistic sample soil report from our diagnostic laboratory database.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg cursor-pointer transition-all border-0 shadow-xs shrink-0"
                >
                  Load Sample Report
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* Stage 2: Processing AI Pipeline */}
        {stage === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-6">
              
              {/* Stepper Progress bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Activity className="w-4 h-4 animate-pulse" />
                    AI Soil Diagnostic Pipeline
                  </span>
                  <span className="text-xs font-black text-gray-800">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Sub-steps flow tracker */}
              <div className="grid grid-cols-4 gap-2">
                {processingSteps.map((step) => {
                  const isActive = currentStep === step.key;
                  const isDone = progress >= step.pct;
                  return (
                    <div key={step.key} className="text-center space-y-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-300 ${
                        isDone ? "bg-primary" : isActive ? "bg-emerald-300 animate-pulse" : "bg-gray-150"
                      }`} />
                      <span className={`block text-[8px] font-bold ${
                        isActive ? "text-primary" : isDone ? "text-gray-800" : "text-gray-400"
                      } leading-tight uppercase`}>
                        {step.label.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Holographic scanning HUD */}
              <div className="border border-gray-150 rounded-2xl bg-gray-50/50 p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary animate-pulse" />
                <FileText className="w-10 h-10 text-primary shrink-0 animate-bounce" />
                <div className="text-xs flex-1">
                  <p className="font-extrabold text-gray-800">{file?.name}</p>
                  <p className="text-gray-400 mt-0.5">{file?.size} • Document Parser Active</p>
                </div>
                {/* Glowing Laser Scan Bar */}
                <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent pointer-events-none animate-pulse" />
              </div>

              {/* Linux Terminal-style Logs Console */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-900 shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-3">
                  <span>TELEMETRY DIAGNOSTIC CORE</span>
                  <span className="animate-pulse text-emerald-400 font-mono">LIVE FEED</span>
                </div>
                <div className="h-36 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1.5 text-left custom-scrollbar">
                  {logs.map((log, i) => (
                    <div key={i} className={log.includes("[SUCCESS]") ? "text-emerald-400" : log.includes("[SYSTEM]") ? "text-indigo-400" : "text-slate-300"}>
                      {log}
                    </div>
                  ))}
                  <div ref={consoleBottomRef} />
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* Stage 3: Analytical Nutrient Board results */}
        {stage === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Top Analysis Complete Banner */}
            <div className="bg-emerald-50 border border-emerald-100/50 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
              {/* Backglow decor */}
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-100/30 rounded-full filter blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-primary text-white rounded-2xl shadow-md shrink-0">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">AI Diagnostic Complete</h3>
                  <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Source: {file?.name} • Extracted successfully
                  </p>
                </div>
              </div>

              <div className="flex gap-2 relative z-10 w-full md:w-auto">
                <button
                  onClick={resetScanner}
                  className="flex-1 md:flex-initial px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-250 rounded-xl text-xs font-bold text-gray-650 cursor-pointer transition-colors shadow-xs"
                >
                  Upload New Report
                </button>
                <button
                  onClick={onRecommendationClick}
                  className="flex-1 md:flex-initial px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border-0 cursor-pointer shadow-md shadow-primary/10"
                >
                  Generate Advisory Formulation
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Nutrient Chemistry Board Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Nitrogen */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Moderate Deficiency
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">135 / 180 mg/kg</span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 mt-4">Nitrogen Index (N)</h4>
                  
                  {/* Progress bar */}
                  <div className="my-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: "75%" }} />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-normal">
                    <strong>Deficit: -45 mg/kg.</strong> Sub-optimal nitrogen limits foliage surface area expansion and restricts chlorophyll chlorophyll absorption. Slow release blends advised.
                  </p>
                </div>
                <div className="border-t border-gray-50 mt-5 pt-3.5 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
                  <span>Primary Nutrient</span>
                  <span className="text-amber-600 flex items-center gap-0.5">
                    Action Required <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.div>

              {/* Card 2: Phosphorus */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Stable Vigor
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">24 / 35 mg/kg</span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 mt-4">Phosphorus Index (P)</h4>
                  
                  {/* Progress bar */}
                  <div className="my-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "68%" }} />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-normal">
                    <strong>Deficit: -11 mg/kg.</strong> Root absorption and stem structures are healthy. Slight top-ups during standard seasonal cycles are sufficient to maintain root structural development.
                  </p>
                </div>
                <div className="border-t border-gray-50 mt-5 pt-3.5 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
                  <span>Primary Nutrient</span>
                  <span className="text-emerald-700">Satisfactory Status</span>
                </div>
              </motion.div>

              {/* Card 3: Potassium */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-3xl border-rose-200 border-2 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden"
              >
                {/* Critical Glow decor */}
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-rose-500" />
                
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Critical Depletion
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">160 / 280 mg/kg</span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 mt-4 flex items-center gap-1">
                    Potassium Index (K)
                  </h4>
                  
                  {/* Progress bar */}
                  <div className="my-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full animate-pulse" style={{ width: "57%" }} />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-normal">
                    <strong>Deficit: -120 mg/kg.</strong> Potassium is essential for bunch weight development and oil conversion rates in oil palm. Severe deficit restricts kernel development. Immediate action.
                  </p>
                </div>
                <div className="border-t border-gray-50 mt-5 pt-3.5 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
                  <span>Primary Nutrient</span>
                  <span className="text-rose-600 font-extrabold flex items-center gap-0.5">
                    Critical Alert <AlertTriangle className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.div>

              {/* Card 4: Organic Carbon */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-[#2E7D32] bg-[#A5D6A7]/25 border border-emerald-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Optimal Range
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">1.82% / 2.0%</span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 mt-4">Organic Carbon (C)</h4>
                  
                  {/* Progress bar */}
                  <div className="my-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "91%" }} />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-normal">
                    Healthy carbon ratios represent optimal organic humus density. Promotes rich micro-organism activity and sustains fertilizer retention rates in sandy soils.
                  </p>
                </div>
                <div className="border-t border-gray-50 mt-5 pt-3.5 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
                  <span>Soil Chemistry</span>
                  <span className="text-primary font-bold">Excellent Health</span>
                </div>
              </motion.div>

              {/* Card 5: pH Index */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Optimal pH
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">5.85 pH</span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 mt-4">Soil Acidity (pH)</h4>
                  
                  {/* Progress bar */}
                  <div className="my-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "78%" }} />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-normal">
                    Acidity index falls into the perfect sub-acidic range preferred by oil palm trees. Optimizes chemical mobility, ensuring micro-elements are readily soluble.
                  </p>
                </div>
                <div className="border-t border-gray-50 mt-5 pt-3.5 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
                  <span>Soil Chemistry</span>
                  <span className="text-emerald-700">Optimal Range</span>
                </div>
              </motion.div>

              {/* Card 6: Micronutrients */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Minor Deficits
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">Boron, Zn, Fe</span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 mt-4">Micronutrients Profile</h4>
                  
                  {/* Micro list with small meters */}
                  <div className="my-4 space-y-2 text-[10px]">
                    <div>
                      <div className="flex justify-between mb-0.5 font-bold">
                        <span>Boron (B) - Deficient</span>
                        <span>1.1 ppm</span>
                      </div>
                      <div className="w-full h-1 bg-gray-150 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: "45%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5 font-semibold">
                        <span>Zinc (Zn) - Good</span>
                        <span>4.5 ppm</span>
                      </div>
                      <div className="w-full h-1 bg-gray-150 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: "80%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5 font-semibold">
                        <span>Iron (Fe) - Good</span>
                        <span>24.2 ppm</span>
                      </div>
                      <div className="w-full h-1 bg-gray-150 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: "75%" }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-50 mt-5 pt-3.5 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
                  <span>Microelements</span>
                  <span className="text-amber-600 font-bold flex items-center gap-0.5">
                    Boron boost needed <Sparkles className="w-3 h-3 fill-amber-100" />
                  </span>
                </div>
              </motion.div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
};
