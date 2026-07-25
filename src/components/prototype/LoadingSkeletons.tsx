import React from "react";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse text-left">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div className="space-y-2.5 w-full max-w-sm">
          <div className="h-7 w-2/3 bg-gray-200 rounded-lg shimmer" />
          <div className="h-4 w-1/2 bg-gray-200 rounded-md shimmer" />
        </div>
        <div className="h-9 w-36 bg-gray-200 rounded-xl shimmer" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 bg-gray-200 rounded-xl shimmer" />
              <div className="w-12 h-4 bg-gray-100 rounded-full shimmer" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-2/3 bg-gray-100 rounded-md shimmer" />
              <div className="h-7 w-1/2 bg-gray-200 rounded-lg shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2 (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Farm Overview Card */}
            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-5">
              <div className="h-4 w-1/3 bg-gray-200 rounded-full shimmer" />
              <div className="h-5 w-1/2 bg-gray-200 rounded-lg shimmer" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-gray-50">
                    <div className="h-3 w-1/3 bg-gray-100 rounded-md shimmer" />
                    <div className="h-3 w-1/4 bg-gray-200 rounded-md shimmer" />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights Card */}
            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-5">
              <div className="h-4 w-1/3 bg-gray-200 rounded-full shimmer" />
              <div className="h-5 w-1/2 bg-gray-200 rounded-lg shimmer" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mt-1.5 shrink-0 shimmer" />
                    <div className="h-3 w-5/6 bg-gray-100 rounded-md shimmer" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GIS Map Card */}
          <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-white to-gray-50/50">
              <div className="space-y-1.5 w-1/3">
                <div className="h-4 w-2/3 bg-gray-200 rounded-md shimmer" />
                <div className="h-3 w-1/2 bg-gray-100 rounded-md shimmer" />
              </div>
            </div>
            <div className="h-64 bg-slate-900 flex items-center justify-center p-6">
              <div className="w-5/6 h-5/6 bg-slate-800 rounded-xl shimmer opacity-20" />
            </div>
          </div>
        </div>

        {/* Column 3 (1/3 width) */}
        <div className="space-y-6">
          {/* Weather Card */}
          <div className="bg-gradient-to-tr from-emerald-800 to-emerald-700 rounded-3xl p-6 shadow-md space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5 w-1/2">
                <div className="h-3 w-2/3 bg-emerald-600 rounded-md shimmer" />
                <div className="h-4 w-5/6 bg-emerald-500 rounded-lg shimmer" />
              </div>
              <div className="w-10 h-10 bg-emerald-600 rounded-xl shimmer" />
            </div>
            <div className="h-8 w-1/3 bg-emerald-500 rounded-lg shimmer" />
            <div className="space-y-2 pt-2 border-t border-white/10">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-1/4 bg-emerald-600 rounded-md shimmer" />
                  <div className="h-3 w-1/6 bg-emerald-500 rounded-md shimmer" />
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-4">
            <div className="h-4 w-1/2 bg-gray-200 rounded-lg shimmer" />
            <div className="pl-6 border-l border-gray-150 space-y-6 relative">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-1.5 relative">
                  <span className="absolute -left-[29px] top-1 w-2.5 h-2.5 rounded-full bg-gray-200 border-2 border-white shimmer" />
                  <div className="flex justify-between">
                    <div className="h-3.5 w-1/2 bg-gray-200 rounded-md shimmer" />
                    <div className="h-3 w-12 bg-gray-100 rounded-md shimmer" />
                  </div>
                  <div className="h-3 w-5/6 bg-gray-150 rounded-md shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FarmerTableSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div className="space-y-2.5 w-full max-w-sm">
          <div className="h-7 w-2/3 bg-gray-200 rounded-lg shimmer" />
          <div className="h-4 w-1/2 bg-gray-200 rounded-md shimmer" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded-xl shimmer" />
      </div>

      {/* Filters block */}
      <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="h-9 w-full sm:w-64 bg-gray-100 rounded-xl shimmer" />
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="h-9 w-28 bg-gray-100 rounded-xl shimmer" />
          <div className="h-9 w-28 bg-gray-100 rounded-xl shimmer" />
        </div>
      </div>

      {/* Table Card Skeleton */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs">
        <div className="p-4 bg-gray-55/75 border-b border-gray-150 grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded-md shimmer" />
          ))}
        </div>
        <div className="divide-y divide-gray-100 p-4 space-y-4">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-4 py-2">
              <div className="h-3.5 bg-gray-200 rounded-md shimmer w-3/4" />
              <div className="h-3.5 bg-gray-150 rounded-md shimmer w-1/2" />
              <div className="h-3.5 bg-gray-150 rounded-md shimmer w-2/3" />
              <div className="h-3.5 bg-gray-200 rounded-md shimmer w-1/3" />
              <div className="h-3.5 bg-gray-150 rounded-md shimmer w-1/4 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SoilReportSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse text-left">
      {/* Header */}
      <div className="border-b border-gray-200/50 pb-5 space-y-2.5">
        <div className="h-7 w-1/3 bg-gray-200 rounded-lg shimmer" />
        <div className="h-4 w-1/2 bg-gray-100 rounded-md shimmer" />
      </div>

      {/* Banner Skeleton */}
      <div className="bg-white rounded-3xl border border-gray-150 p-6 flex justify-between items-center shadow-xs">
        <div className="flex gap-4 items-center w-2/3">
          <div className="w-12 h-12 bg-gray-200 rounded-2xl shimmer" />
          <div className="space-y-2 flex-grow">
            <div className="h-4 w-1/4 bg-gray-200 rounded-md shimmer" />
            <div className="h-3.5 w-1/2 bg-gray-150 rounded-md shimmer" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-24 bg-gray-100 rounded-xl shimmer" />
          <div className="h-9 w-32 bg-gray-200 rounded-xl shimmer" />
        </div>
      </div>

      {/* Nutrient Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-4">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-gray-200 rounded-full shimmer" />
              <div className="h-3 w-16 bg-gray-150 rounded-md shimmer" />
            </div>
            <div className="h-5 w-2/3 bg-gray-200 rounded-lg shimmer" />
            <div className="h-1.5 w-full bg-gray-100 rounded-full shimmer" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full bg-gray-150 rounded-md shimmer" />
              <div className="h-3 w-5/6 bg-gray-150 rounded-md shimmer" />
            </div>
            <div className="border-t border-gray-50 pt-3 flex justify-between">
              <div className="h-3.5 w-16 bg-gray-100 rounded-md shimmer" />
              <div className="h-3.5 w-16 bg-gray-150 rounded-md shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse text-left">
      {/* Header */}
      <div className="border-b border-gray-200/50 pb-5 space-y-2.5">
        <div className="h-7 w-1/3 bg-gray-200 rounded-lg shimmer" />
        <div className="h-4 w-1/2 bg-gray-100 rounded-md shimmer" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs space-y-4">
            <div className="h-4 w-1/2 bg-gray-200 rounded-md shimmer" />
            <div className="h-44 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-center p-4">
              {i === 2 ? (
                // Doughnut chart skeleton
                <div className="w-28 h-28 rounded-full border-8 border-gray-200 flex items-center justify-center shimmer" />
              ) : (
                // Graph bars/line grid skeleton
                <div className="w-5/6 h-5/6 bg-gray-100 rounded-xl shimmer" />
              )}
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <div className="w-12 h-3.5 bg-gray-150 rounded-md shimmer" />
              <div className="w-12 h-3.5 bg-gray-150 rounded-md shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs">
        <div className="p-4 bg-gray-50 border-b border-gray-150 grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded-md shimmer" />
          ))}
        </div>
        <div className="divide-y divide-gray-100 p-4 space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="grid grid-cols-6 gap-4 py-2">
              <div className="h-3.5 bg-gray-200 rounded-md shimmer w-3/4" />
              <div className="h-3.5 bg-gray-150 rounded-md shimmer w-1/2" />
              <div className="h-3.5 bg-gray-250 rounded-md shimmer w-2/3" />
              <div className="h-3.5 bg-gray-200 rounded-md shimmer w-1/2" />
              <div className="h-3.5 bg-gray-150 rounded-md shimmer w-1/3" />
              <div className="h-3.5 bg-gray-150 rounded-md shimmer w-1/4 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const GenericSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse text-left">
      <div className="border-b border-gray-200/50 pb-5 space-y-2">
        <div className="h-7 w-1/4 bg-gray-200 rounded-lg shimmer" />
        <div className="h-3.5 w-1/3 bg-gray-100 rounded-md shimmer" />
      </div>

      <div className="bg-white rounded-3xl border border-gray-150 p-8 shadow-xs space-y-6">
        <div className="h-4 w-1/3 bg-gray-200 rounded-md shimmer" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-16 bg-gray-200 rounded-md shimmer" />
              <div className="h-10 w-full bg-gray-50 border border-gray-200 rounded-xl shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
