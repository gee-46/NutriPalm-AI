import { useTranslation } from "../../translation/useTranslation";
import React from "react";
import { motion } from "framer-motion";
import { MapPinOff, LayoutDashboard } from "lucide-react";

interface NotFoundScreenProps {
  onBack: () => void;
}

export const NotFoundScreen: React.FC<NotFoundScreenProps> = ({ onBack }) => {
    const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="max-w-md mx-auto py-12 text-center"
    >
      <div className="bg-white rounded-3xl border border-gray-150 p-8 shadow-xs space-y-6 relative overflow-hidden">
        {/* Glow backdrop decorative blobs */}
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-rose-50/40 rounded-full filter blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-emerald-50/40 rounded-full filter blur-xl pointer-events-none" />

        {/* 404 Visual Icon */}
        <div className="mx-auto w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 relative z-10">
          <MapPinOff className="w-8 h-8" />
        </div>

        {/* Text Details */}
        <div className="space-y-2 relative z-10">
          <h2 className="text-4xl font-black text-gray-950 tracking-tight leading-none">404</h2>
          <h3 className="text-base font-extrabold text-gray-800">{t('notfoundscreen.coordinates_uncharted')}</h3>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
            
                                  {t('notfoundscreen.the_telemetry_coordinate_page_you_reques')}
                                </p>
        </div>

        {/* Visual Map Grid mock illustration */}
        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 flex flex-col gap-2 relative z-10">
          <div className="grid grid-cols-5 gap-1.5 opacity-40">
            {Array.from({ length: 15 }).map((_, i) => (
              <div 
                key={i} 
                className={`h-5 rounded-md border ${
                  i === 7 ? "bg-rose-100 border-rose-300 animate-pulse" : "bg-white border-gray-200"
                }`} 
              />
            ))}
          </div>
          <span className="text-[9px] font-mono text-rose-600 font-extrabold uppercase">{t('notfoundscreen.gps_search_lock_failed')}</span>
        </div>

        {/* Return Action */}
        <div className="pt-2 relative z-10">
          <button
            onClick={onBack}
            className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            
                                  {t('notfoundscreen.return_to_dashboard')}
                                </button>
        </div>
      </div>
    </motion.div>
  );
};
