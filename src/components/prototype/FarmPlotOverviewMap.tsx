/**
 * FarmPlotOverviewMap.tsx
 *
 * Interactive GIS Leaflet map for the main Farm Plot Management screen.
 * Displays all user-owned farm plots with real spatial boundaries, genuine
 * satellite/aerial imagery (Esri World Imagery / MapTiler), standard OSM basemaps,
 * and data overlays (NDVI Crop Health, Soil Moisture, Boundary Outline).
 *
 * Features:
 * - Real satellite tile layer (Esri World Imagery / MapTiler) with automatic error fallback
 * - Real standard/terrain tile layer (OpenStreetMap)
 * - Clear separation of Basemap (Satellite vs Standard) and Data Overlays (NDVI vs Soil vs Boundary)
 * - Non-overlapping plot polygons with clean centroid label badges (no duplication)
 * - Interactive polygon hover tooltips and click-to-select
 * - Smooth viewport fitting to encompass all plots or pan to the selected plot
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Globe, Layers, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { Plot, GeoJSONPolygon } from "../../data/plots";

import { computeCentroid } from "../../lib/geo";

// ---------------------------------------------------------------------------
// Basemap Tile Configurations
// ---------------------------------------------------------------------------

const MAPTILER_KEY = (import.meta as any).env?.VITE_MAPTILER_API_KEY as string | undefined;

function getSatelliteTileConfig(): { url: string; attribution: string; maxZoom: number } {
  if (MAPTILER_KEY) {
    return {
      url: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
      attribution: "© MapTiler © Airbus, Maxar",
      maxZoom: 20,
    };
  }
  // Esri World Imagery: Real satellite/aerial imagery, free and keyless for non-commercial/app use
  return {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  };
}

const STANDARD_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const STANDARD_ATTRIBUTION = "© OpenStreetMap contributors";

export type BasemapMode = "Satellite" | "Terrain";
export type DataOverlayLayer = "NDVI" | "Moisture" | "Boundary";

interface FarmPlotOverviewMapProps {
  plots: Plot[];
  selectedPlotId: string;
  onSelectPlot: (plotId: string) => void;
  basemapMode: BasemapMode;
  onBasemapModeChange: (mode: BasemapMode) => void;
  activeLayer: DataOverlayLayer;
  onActiveLayerChange: (layer: DataOverlayLayer) => void;
  isScanning?: boolean;
  onForceScan?: () => void;
  showToast?: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const FarmPlotOverviewMap: React.FC<FarmPlotOverviewMapProps> = ({
  plots,
  selectedPlotId,
  onSelectPlot,
  basemapMode,
  onBasemapModeChange,
  activeLayer,
  onActiveLayerChange,
  isScanning = false,
  onForceScan,
  showToast,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const standardLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const labelMarkersGroupRef = useRef<L.LayerGroup | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);

  const isDemoDataset = plots.some((p) => p.isDemo || p.id.startsWith("plot-"));
  const mappedPlotCount = plots.filter((p) => p.boundaryMapped && p.geoJSON).length;

  // ---------------------------------------------------------------------------
  // Initialize Leaflet Map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Fix default marker icon issues
    // @ts-expect-error - Leaflet private property
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, {
      center: [17.3890, 78.4920],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    const satConfig = getSatelliteTileConfig();
    const standardLayer = L.tileLayer(STANDARD_TILE_URL, {
      maxZoom: 19,
      attribution: STANDARD_ATTRIBUTION,
    });
    const satelliteLayer = L.tileLayer(satConfig.url, {
      maxZoom: satConfig.maxZoom,
      attribution: satConfig.attribution,
    });

    // Satellite error fallback
    let satelliteFailed = false;
    satelliteLayer.on("tileerror", () => {
      if (satelliteFailed) return;
      satelliteFailed = true;
      if (map.hasLayer(satelliteLayer)) {
        map.removeLayer(satelliteLayer);
        standardLayer.addTo(map);
        onBasemapModeChange("Terrain");
        if (showToast) {
          showToast("Satellite imagery service unavailable — fallback to standard map.", "warning");
        }
      }
    });

    standardLayerRef.current = standardLayer;
    satelliteLayerRef.current = satelliteLayer;

    // Attach initial basemap
    if (basemapMode === "Satellite") {
      satelliteLayer.addTo(map);
    } else {
      standardLayer.addTo(map);
    }

    const polygonGroup = L.featureGroup().addTo(map);
    const labelGroup = L.layerGroup().addTo(map);
    polygonLayersGroupRef.current = polygonGroup;
    labelMarkersGroupRef.current = labelGroup;

    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Sync Basemap Layer (Satellite vs Terrain/Standard)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const standardLayer = standardLayerRef.current;
    const satelliteLayer = satelliteLayerRef.current;
    if (!map || !standardLayer || !satelliteLayer) return;

    if (basemapMode === "Satellite") {
      if (map.hasLayer(standardLayer)) map.removeLayer(standardLayer);
      if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
    } else {
      if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
      if (!map.hasLayer(standardLayer)) standardLayer.addTo(map);
    }
  }, [basemapMode]);

  // ---------------------------------------------------------------------------
  // Render Plot Polygons & Centroid Labels (Strict real geometry)
  // ---------------------------------------------------------------------------
  const renderPlotLayers = useCallback(async () => {
    const map = mapRef.current;
    const polygonGroup = polygonLayersGroupRef.current;
    const labelGroup = labelMarkersGroupRef.current;
    if (!map || !polygonGroup || !labelGroup) return;

    polygonGroup.clearLayers();
    labelGroup.clearLayers();

    if (plots.length === 0) return;

    const allPolygons: L.Polygon[] = [];

    for (const plot of plots) {
      // ONLY render real polygon if boundaryMapped and valid geoJSON exist
      const geoJSON: GeoJSONPolygon | null =
        plot.boundaryMapped && plot.geoJSON ? plot.geoJSON : null;

      // Do NOT invent fake geometry if not mapped
      if (!geoJSON || !geoJSON.coordinates || !geoJSON.coordinates[0] || geoJSON.coordinates[0].length < 3) {
        continue;
      }


      const ring = geoJSON.coordinates[0];
      const latLngs: [number, number][] = ring.map(([lng, lat]) => [lat, lng]);

      const isSelected = plot.id === selectedPlotId;

      // Color coding based on Active Layer & Plot Status
      let fillColor = "#10b981";
      let strokeColor = "#10b981";
      let fillOpacity = 0.40;
      let strokeWidth = isSelected ? 3.5 : 2;

      if (activeLayer === "NDVI") {
        if (plot.status === "Healthy" || (plot.ndvi && plot.ndvi >= 0.75)) {
          fillColor = "#10b981";
          strokeColor = isSelected ? "#ffffff" : "#059669";
          fillOpacity = 0.45;
        } else if (plot.status === "Moderate" || (plot.ndvi && plot.ndvi >= 0.60)) {
          fillColor = "#84cc16";
          strokeColor = isSelected ? "#ffffff" : "#65a30d";
          fillOpacity = 0.45;
        } else if (plot.status === "Needs Attention" || (plot.ndvi && plot.ndvi >= 0.45)) {
          fillColor = "#f59e0b";
          strokeColor = isSelected ? "#ffffff" : "#d97706";
          fillOpacity = 0.50;
        } else {
          fillColor = "#e11d48";
          strokeColor = isSelected ? "#ffffff" : "#be123c";
          fillOpacity = 0.55;
        }
      } else if (activeLayer === "Moisture") {
        fillColor = "#2563eb";
        strokeColor = isSelected ? "#ffffff" : "#1d4ed8";
        fillOpacity = 0.45;
      } else if (activeLayer === "Boundary") {
        fillColor = "#0284c7";
        strokeColor = isSelected ? "#ffffff" : "#38bdf8";
        fillOpacity = 0.15;
        strokeWidth = isSelected ? 3.5 : 2.5;
      }

      const polygon = L.polygon(latLngs, {
        color: strokeColor,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        weight: strokeWidth,
        dashArray: activeLayer === "Boundary" ? "6, 4" : undefined,
      });

      // Highlight on hover & click handling
      polygon.on("click", () => {
        onSelectPlot(plot.id);
      });

      polygon.on("mouseover", () => {
        polygon.setStyle({
          weight: strokeWidth + 2,
          fillOpacity: Math.min(fillOpacity + 0.2, 0.8),
        });
      });

      polygon.on("mouseout", () => {
        polygon.setStyle({
          weight: strokeWidth,
          fillOpacity: fillOpacity,
        });
      });

      // Rich hover tooltip with genuine plot metadata
      const ndviText = plot.ndvi ? `${Math.round(plot.ndvi * 100)}%` : "N/A";
      const soilText = plot.soilHealth?.Current ? `${plot.soilHealth.Current}%` : "No data";
      polygon.bindTooltip(
        `
        <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; line-height: 1.4; min-width: 130px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">${plot.name}</div>
          <div style="color: #64748b; font-size: 10px;">${plot.crop} • ${plot.area} Acres</div>
          <div style="margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Status:</span>
            <strong style="color: ${fillColor};">${plot.status}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">NDVI:</span>
            <strong>${ndviText}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Soil Health:</span>
            <strong>${soilText}</strong>
          </div>
        </div>
        `,
        { sticky: true, className: "custom-leaflet-tooltip" }
      );

      polygon.addTo(polygonGroup);
      allPolygons.push(polygon);

      // -----------------------------------------------------------------------
      // Compute Centroid & Render Single, Clean Centroid Label Badge
      // -----------------------------------------------------------------------
      const centroid = await computeCentroid(geoJSON);
      const labelPos: [number, number] = centroid
        ? [centroid.lat, centroid.lng]
        : [latLngs[0][0], latLngs[0][1]];

      // Distinct dot indicator color
      const statusDot =
        plot.status === "Healthy"
          ? "#10b981"
          : plot.status === "Moderate"
          ? "#84cc16"
          : plot.status === "Needs Attention"
          ? "#f59e0b"
          : "#e11d48";

      const labelHtml = `
        <div style="
          transform: translate(-50%, -50%);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(15, 23, 42, ${isSelected ? "0.95" : "0.85"});
          backdrop-filter: blur(6px);
          color: ${isSelected ? "#ffffff" : "#e2e8f0"};
          padding: 3px 8px;
          border-radius: 9999px;
          border: 1px solid ${isSelected ? "#ffffff" : "rgba(255,255,255,0.2)"};
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          user-select: none;
        ">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusDot}; flex-shrink: 0;"></span>
          <span>${plot.name.length > 18 ? plot.name.slice(0, 16) + "…" : plot.name}</span>
          <span style="color: #94a3b8; font-size: 9px;">(${plot.area} ac)</span>
        </div>
      `;

      const labelIcon = L.divIcon({
        className: "clean-plot-label",
        html: labelHtml,
        iconSize: [0, 0],
      });

      L.marker(labelPos, { icon: labelIcon, interactive: false }).addTo(labelGroup);
    }

    // Auto fit viewport bounds to all plots if available
    if (allPolygons.length > 0 && polygonGroup.getBounds().isValid()) {
      map.fitBounds(polygonGroup.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  }, [plots, selectedPlotId, activeLayer, onSelectPlot]);

  useEffect(() => {
    renderPlotLayers();
  }, [renderPlotLayers]);

  // Center on selected plot or all plots
  const handleCenterMap = () => {
    const map = mapRef.current;
    const polygonGroup = polygonLayersGroupRef.current;
    if (!map || !polygonGroup) return;

    if (polygonGroup.getBounds().isValid()) {
      map.fitBounds(polygonGroup.getBounds(), { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView([17.3890, 78.4920], 15);
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className="space-y-3">
      {/* ================= MAP CONTROLS TOOLBAR ================= */}
      <div className="bg-white rounded-2xl p-3.5 border border-gray-150 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
        
        {/* Left: Basemap Toggle & Data Overlay Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* 1. Base Map Switcher */}
          <div className="inline-flex rounded-xl p-0.5 bg-gray-100 border border-gray-200">
            <button
              type="button"
              onClick={() => onBasemapModeChange("Satellite")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                basemapMode === "Satellite"
                  ? "bg-primary text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Satellite View
            </button>
            <button
              type="button"
              onClick={() => onBasemapModeChange("Terrain")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                basemapMode === "Terrain"
                  ? "bg-primary text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Standard / Terrain
            </button>
          </div>

          <div className="h-5 w-[1px] bg-gray-250 mx-1 hidden sm:block" />

          {/* 2. Data Overlays */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onActiveLayerChange("NDVI")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeLayer === "NDVI"
                  ? "bg-[#84cc16]/15 text-[#4d7c0f] border-[#84cc16]/50 shadow-xs"
                  : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
              }`}
            >
              🌿 NDVI Crop Health
            </button>
            <button
              type="button"
              onClick={() => onActiveLayerChange("Moisture")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeLayer === "Moisture"
                  ? "bg-blue-50 text-blue-700 border-blue-300 shadow-xs"
                  : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
              }`}
            >
              💧 Soil & Moisture
            </button>
            <button
              type="button"
              onClick={() => onActiveLayerChange("Boundary")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeLayer === "Boundary"
                  ? "bg-sky-50 text-sky-800 border-sky-300 shadow-xs"
                  : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
              }`}
            >
              📐 Boundary View
            </button>
          </div>
        </div>

        {/* Right: Map Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg border border-gray-250 bg-white flex items-center justify-center text-xs font-bold hover:bg-gray-50 cursor-pointer shadow-xs"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg border border-gray-250 bg-white flex items-center justify-center text-xs font-bold hover:bg-gray-50 cursor-pointer shadow-xs"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={handleCenterMap}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-250 bg-white text-xs font-bold hover:bg-gray-50 cursor-pointer shadow-xs text-gray-700"
            title="Center All Plots"
          >
            <Maximize2 className="w-3 h-3 text-gray-500" />
            Fit Plots
          </button>
        </div>
      </div>

      {/* ================= INTERACTIVE GIS MAP CONTAINER ================= */}
      <div className="bg-slate-950 rounded-3xl border border-slate-900 shadow-lg overflow-hidden relative">
        
        {/* Status Overlay Badge */}
        <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-[10px] text-emerald-400 font-mono flex items-center gap-2 shadow-md">
              <Globe className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
              <span>BASE: {basemapMode.toUpperCase()} | OVERLAY: {activeLayer.toUpperCase()}</span>
            </div>
            {isDemoDataset && (
              <div className="bg-amber-500/90 backdrop-blur-md text-slate-950 font-black text-[10px] px-3 py-2 rounded-xl shadow-md border border-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <span>⚠️ Sample Demo Plots</span>
              </div>
            )}
          </div>

          {onForceScan && (
            <button
              type="button"
              onClick={onForceScan}
              disabled={isScanning}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-[10px] flex items-center gap-1.5 transition-all cursor-pointer border-0 shadow-md pointer-events-auto"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "RE-INDEXING GNSS..." : "FORCE SATELLITE SYNC"}
            </button>
          )}
        </div>

        {/* Unmapped Plots Overlay Banner for real user accounts */}
        {!isDemoDataset && plots.length > 0 && mappedPlotCount === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center p-6 pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl border border-slate-800 text-center max-w-md shadow-2xl pointer-events-auto space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black text-white">No GPS Boundaries Mapped Yet</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your plots do not have stored GPS polygon boundaries. Satellite NDVI and GIS overlays will activate as soon as you draw or import your farm boundaries.
              </p>
            </div>
          </div>
        )}

        {/* Leaflet Map DOM Element */}
        <div
          ref={mapContainerRef}
          className="h-[420px] w-full relative z-0"
          style={{ cursor: "grab" }}
        />

        {/* Bottom Coordinates & EPSG Readout */}
        <div className="absolute bottom-3 left-4 z-[400] bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 flex items-center gap-2 shadow-xs pointer-events-none">
          <span>WGS-84 (EPSG:4326)</span>
          {mouseCoords && (
            <span className="text-emerald-400">
              {mouseCoords.lat.toFixed(4)}° N, {mouseCoords.lng.toFixed(4)}° E
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

