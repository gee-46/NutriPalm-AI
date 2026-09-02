/**
 * LeafletMapPicker.tsx
 *
 * A self-contained Leaflet map with geoman polygon drawing, used in
 * FarmPlotScreen's wizard Step 2 to replace the static-text coordinates input.
 *
 * Visual design: matches the existing bg-slate-950 rounded-3xl card pattern
 * used for the main map canvas in FarmPlotScreen.
 *
 * Emits: onBoundaryChange({ geoJSON, areaAcres, centroid })
 * GPS denied → falls back to Hyderabad region default center
 * Touch: leaflet-geoman is touch-compatible by default
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, AlertTriangle, PenTool, Edit3, Trash2, RefreshCw, Search, Layers as LayersIcon, Crosshair } from "lucide-react";
import { AnimatedCounter } from "./FarmPlotScreen";
import {
  computePolygonAreaAcres,
  computeCentroid,
  validatePolygon,
  acresToHectares,
  type GeoJSONPolygon,
} from "../../lib/geo";

// ---------------------------------------------------------------------------
// Leaflet CSS — must be imported for tiles/markers to display correctly
// We use a dynamic import-like approach with a style tag to avoid build issues
// ---------------------------------------------------------------------------
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoundaryData {
  geoJSON: GeoJSONPolygon;
  areaAcres: number;
  centroid: { lat: number; lng: number } | null;
}

export interface LeafletMapPickerProps {
  /** Called whenever a polygon is drawn or cleared */
  onBoundaryChange: (data: BoundaryData | null) => void;
  /** Pre-fill with an existing boundary (e.g. from GeoJSON import) */
  initialGeoJSON?: GeoJSONPolygon;
  /** Controlled area unit display */
  areaUnit?: "acres" | "hectares";
  showToast?: (msg: string, type?: "success" | "info" | "warning") => void;
}

// ---------------------------------------------------------------------------
// Default center: Telangana, India (Oil Palm belt)
// ---------------------------------------------------------------------------
const DEFAULT_CENTER: [number, number] = [17.3912, 78.4948];
const DEFAULT_ZOOM = 14;

// ---------------------------------------------------------------------------
// Real basemap providers
//
// Standard map: OpenStreetMap (free, no key).
//
// Satellite/aerial: Esri World Imagery is used by default -- it is a real,
// legitimate aerial/satellite imagery service that is free to use for
// non-commercial/demo purposes without an API key
// (https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9).
//
// If VITE_MAPTILER_API_KEY is set, we upgrade to MapTiler's higher-resolution
// commercial satellite tiles instead. The key is a public/publishable Vite
// key embedded in the built frontend bundle (same trust model as the
// existing VITE_SUPABASE_ANON_KEY) -- MapTiler tile keys are designed to be
// used client-side and are domain-restricted on the provider's dashboard,
// not a secret. If the key is absent or the tile layer fails to load, the
// app falls back to Esri World Imagery and never breaks.
// ---------------------------------------------------------------------------

type BasemapId = "standard" | "satellite";

const MAPTILER_KEY = (import.meta as any).env?.VITE_MAPTILER_API_KEY as string | undefined;

function getSatelliteTileConfig(): { url: string; attribution: string; maxZoom: number } {
  if (MAPTILER_KEY) {
    return {
      url: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
      attribution: "© MapTiler © Airbus, Maxar, CNES/Airbus",
      maxZoom: 20,
    };
  }
  // No key configured -- fall back to the free, keyless Esri World Imagery
  // service. This is real satellite/aerial imagery, not a placeholder.
  return {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  };
}

const STANDARD_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const STANDARD_ATTRIBUTION = "© OpenStreetMap contributors";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LeafletMapPicker: React.FC<LeafletMapPickerProps> = ({
  onBoundaryChange,
  initialGeoJSON,
  areaUnit = "acres",
  showToast,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const drawnLayerRef = useRef<import("leaflet").Layer | null>(null);
  const standardLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const satelliteLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const accuracyCircleRef = useRef<import("leaflet").Circle | null>(null);
  const triggerToastRef = useRef<((msg: string, type?: "success" | "info" | "warning") => void) | null>(null);

  const [basemap, setBasemapState] = useState<BasemapId>("satellite");
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const [areaAcres, setAreaAcres] = useState<number | null>(null);
  
  // Custom toolbar state
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Live area during drawing
  const [liveArea, setLiveArea] = useState<number | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "info") => {
    if (showToast) showToast(msg, type);
  };
  triggerToastRef.current = triggerToast;

  // ---------------------------------------------------------------------------
  // Basemap switching -- toggles between the real standard and satellite layers
  // ---------------------------------------------------------------------------
  const setBasemap = (next: BasemapId) => {
    const map = mapRef.current;
    if (!map || !standardLayerRef.current || !satelliteLayerRef.current) return;
    if (next === basemap) return;

    if (next === "satellite") {
      if (map.hasLayer(standardLayerRef.current)) map.removeLayer(standardLayerRef.current);
      satelliteLayerRef.current.addTo(map);
    } else {
      if (map.hasLayer(satelliteLayerRef.current)) map.removeLayer(satelliteLayerRef.current);
      standardLayerRef.current.addTo(map);
    }
    setBasemapState(next);
  };

  // ---------------------------------------------------------------------------
  // Initialize Leaflet map (dynamic import to avoid SSR / build issues)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const init = () => {

      // Fix default marker icons (broken in Vite by default)
      // @ts-expect-error - leaflet private property
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: false,
      });

      // Real basemap layers -- standard (OSM) and satellite/aerial (Esri
      // World Imagery, or MapTiler if VITE_MAPTILER_API_KEY is configured).
      // Only one is attached to the map at a time; switching is handled by
      // the toolbar buttons via setBasemap() below.
      const satConfig = getSatelliteTileConfig();
      const standardLayer = L.tileLayer(STANDARD_TILE_URL, {
        maxZoom: 19,
        attribution: STANDARD_ATTRIBUTION,
      });
      const satelliteLayer = L.tileLayer(satConfig.url, {
        maxZoom: satConfig.maxZoom,
        attribution: satConfig.attribution,
      });

      // If the satellite provider fails to load tiles (bad/missing key,
      // network block), fall back to the standard layer instead of showing
      // a blank/broken map.
      let satelliteFailed = false;
      satelliteLayer.on("tileerror", () => {
        if (satelliteFailed) return;
        satelliteFailed = true;
        if (map.hasLayer(satelliteLayer)) {
          map.removeLayer(satelliteLayer);
          standardLayer.addTo(map);
          setBasemapState("standard");
          triggerToastRef.current?.(
            "Satellite imagery unavailable right now — showing standard map.",
            "warning"
          );
        }
      });

      standardLayerRef.current = standardLayer;
      satelliteLayerRef.current = satelliteLayer;
      satelliteLayer.addTo(map); // default view: satellite/aerial

      // Initialize Geoman options but DO NOT add default controls
      // Style drawn layers to match the existing map card's visual language
      map.pm.setGlobalOptions({
        allowSelfIntersection: false,
        templineStyle: { color: "#10b981", weight: 2, dashArray: "4 4" },
        hintlineStyle: { color: "#10b981", weight: 1.5, dashArray: "4 4" },
        pathOptions: {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.25,
          weight: 2,
        },
      });

      // ---------------------------------------------------------------------------
      // Events: polygon create / edit / remove / live draw
      // ---------------------------------------------------------------------------
      map.on("pm:drawstart", (e: any) => {
        setIsDrawing(true);
        setLiveArea(0);
        const workingLayer = e.workingLayer;
        
        workingLayer.on("pm:vertexadded", async (e2: any) => {
          const latlngs = e2.workingLayer.getLatLngs() as import("leaflet").LatLng[];
          if (latlngs && latlngs.length >= 3) {
            try {
              // Create a closed polygon loop for Turf area calculation
              const coords = latlngs.map(ll => [ll.lng, ll.lat]);
              coords.push([latlngs[0].lng, latlngs[0].lat]);
              const tempGeoJSON: GeoJSONPolygon = {
                type: "Polygon",
                coordinates: [coords]
              };
              const acres = await computePolygonAreaAcres(tempGeoJSON);
              setLiveArea(acres);
            } catch {
              // Ignore invalid intermediate shapes
            }
          }
        });
      });

      map.on("pm:drawend", () => {
        setIsDrawing(false);
        setLiveArea(null);
      });

      const handleLayerCreated = (e: { layer: import("leaflet").Layer }) => {
        // Remove previous polygon if any
        if (drawnLayerRef.current) {
          map.removeLayer(drawnLayerRef.current);
        }
        drawnLayerRef.current = e.layer;

        processLayer(e.layer);
      };

      const handleLayerEdited = () => {
        if (drawnLayerRef.current) {
          processLayer(drawnLayerRef.current);
        }
      };

      const handleLayerRemoved = () => {
        drawnLayerRef.current = null;
        setAreaAcres(null);
        setPolygonError(null);
        onBoundaryChange(null);
      };

      map.on("pm:globaleditmodetoggled", (e: any) => setIsEditing(e.enabled));
      map.on("pm:globalremovalmodetoggled", (e: any) => setIsDeleting(e.enabled));

      map.on("pm:create", handleLayerCreated);
      map.on("pm:edit", handleLayerEdited);
      map.on("pm:remove", handleLayerRemoved);

      mapRef.current = map;
      setMapReady(true);

      // Restore initial boundary if provided (e.g. GeoJSON import)
      if (initialGeoJSON) {
        try {
          const layer = L.geoJSON(initialGeoJSON as GeoJSON.GeoJsonObject, {
            style: {
              color: "#10b981",
              fillColor: "#10b981",
              fillOpacity: 0.25,
              weight: 2,
            },
          });
          layer.addTo(map);
          drawnLayerRef.current = layer;
          map.fitBounds(layer.getBounds(), { padding: [30, 30] });
          processLayer(layer);
        } catch {
          // ignore malformed initial GeoJSON
        }
      }
    };

    init();

    // Fix for Leaflet-in-a-modal rendering bugs
    const sizeTimeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(sizeTimeout);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      accuracyCircleRef.current = null;
      standardLayerRef.current = null;
      satelliteLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Process a drawn/edited layer → compute area, centroid, validate
  // ---------------------------------------------------------------------------
  const processLayer = async (
    layer: import("leaflet").Layer
  ) => {
    try {
      const geojson = (layer as import("leaflet").GeoJSON).toGeoJSON?.() ??
        (layer as unknown as { toGeoJSON: () => GeoJSON.Feature }).toGeoJSON();

      // Extract geometry — handle both Feature and raw geometry
      let geometry: GeoJSON.Geometry;
      if (geojson.type === "Feature") {
        geometry = (geojson as GeoJSON.Feature).geometry;
      } else if (geojson.type === "FeatureCollection") {
        const features = (geojson as GeoJSON.FeatureCollection).features;
        if (!features.length) return;
        geometry = features[0].geometry;
      } else {
        geometry = geojson as unknown as GeoJSON.Geometry;
      }

      if (geometry.type !== "Polygon") {
        setPolygonError("Only polygon shapes are supported.");
        return;
      }

      const geoJSONPolygon: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: (geometry as GeoJSON.Polygon).coordinates as number[][][],
      };

      const acres = await computePolygonAreaAcres(geoJSONPolygon);
      const validation = await validatePolygon(geoJSONPolygon, acres);

      if (!validation.valid) {
        setPolygonError(validation.reason ?? "Invalid polygon.");
        onBoundaryChange(null);
        return;
      }

      setPolygonError(null);
      setAreaAcres(acres);

      const centroid = await computeCentroid(geoJSONPolygon);

      onBoundaryChange({ geoJSON: geoJSONPolygon, areaAcres: acres, centroid });
    } catch (err) {
      console.error("Polygon processing error:", err);
      setPolygonError("Could not compute polygon area. Please redraw.");
    }
  };

  // ---------------------------------------------------------------------------
  // GPS: "Use my location" button
  // ---------------------------------------------------------------------------
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser. Pan/search the map manually.");
      return;
    }
    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracyM(typeof accuracy === "number" ? accuracy : null);

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], DEFAULT_ZOOM);

          // Draw/update a small accuracy circle so the user can see how
          // trustworthy this GPS fix is. This is browser/device GPS, not
          // survey-grade positioning.
          if (accuracyCircleRef.current) {
            mapRef.current.removeLayer(accuracyCircleRef.current);
            accuracyCircleRef.current = null;
          }
          if (typeof accuracy === "number") {
            accuracyCircleRef.current = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: "3 3",
            }).addTo(mapRef.current);
          }
        }

        const accuracyText =
          typeof accuracy === "number" ? ` (±${Math.round(accuracy)} m accuracy)` : "";
        triggerToast(
          `Location acquired: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E${accuracyText}`,
          "success"
        );
      },
      (err) => {
        setIsLocating(false);
        setGpsAccuracyM(null);
        let msg: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = "Location permission denied. Enable location access in your browser/device settings, or pan/search the map manually.";
            break;
          case err.TIMEOUT:
            msg = "Location request timed out. Try again, or pan/search the map manually.";
            break;
          case err.POSITION_UNAVAILABLE:
            msg = "Location unavailable right now (weak signal indoors, etc.). Pan/search the map manually.";
            break;
          default:
            msg = "Could not get your location. Pan/search the map manually to find your plot.";
        }
        setGpsError(msg);
        triggerToast(msg, "warning");
        // Already centered on default — no action needed; manual
        // positioning (pan/zoom/search) remains fully available.
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // ---------------------------------------------------------------------------
  // Geocoder: Manual search
  // ---------------------------------------------------------------------------
  const handleSearch = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setGpsError(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 15);
        }
        setSearchQuery(""); // clear after search
        triggerToast("Location found", "success");
      } else {
        setGpsError("Location not found.");
      }
    } catch (err) {
      setGpsError("Failed to search location.");
    } finally {
      setIsSearching(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Area display
  // ---------------------------------------------------------------------------
  const areaDisplay = areaAcres !== null
    ? areaUnit === "hectares"
      ? `${acresToHectares(areaAcres).toFixed(2)} ha`
      : `${areaAcres.toFixed(2)} ac`
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-2">
      {/* Location Search Bar Above Map */}
      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm h-[40px] focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
        <div className="pl-3 text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input 
          type="text" 
          placeholder="Search for your village, city, or district..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          className="bg-transparent border-none text-xs text-gray-800 px-2.5 py-2 w-full focus:outline-none placeholder:text-gray-400 font-semibold"
        />
        <button 
          type="button" 
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 h-full text-xs font-bold transition-all cursor-pointer"
        >
          {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Search"}
        </button>
      </div>

      {/* Map container — styled to match existing bg-slate-950 rounded-3xl card */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative">

        {/* Leaflet map div */}
        <div
          ref={mapContainerRef}
          className="w-full touch-none"
          style={{ height: "320px" }}
        />

        {/* Top overlay controls */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2 pointer-events-none">
          {/* Status badge */}
          <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {mapReady ? "DRAW POLYGON BOUNDARY" : "LOADING MAP..."}
          </div>

          {/* Custom Toolbar */}
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              type="button"
              title="Draw Boundary"
              onClick={() => {
                if (mapRef.current) {
                  if (isDrawing) {
                    mapRef.current.pm.disableDraw();
                  } else {
                    mapRef.current.pm.enableDraw("Polygon", {
                      snappable: true,
                      snapDistance: 20,
                      continueDrawing: true,
                    });
                  }
                }
              }}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isDrawing
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30"
                  : "bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <PenTool className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Edit Boundary"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.pm.toggleGlobalEditMode();
                }
              }}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isEditing
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30"
                  : "bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Delete Boundary"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.pm.toggleGlobalRemovalMode();
                }
              }}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isDeleting
                  ? "bg-rose-500 text-slate-950 border-rose-400 shadow-md shadow-rose-500/30"
                  : "bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Basemap switcher: Standard / Satellite */}
            <div className="flex flex-col rounded-xl border border-slate-700 overflow-hidden bg-slate-900/90">
              <button
                type="button"
                title="Satellite/aerial imagery"
                onClick={() => setBasemap("satellite")}
                className={`min-h-[36px] min-w-[44px] p-2 flex items-center justify-center transition-all cursor-pointer ${
                  basemap === "satellite"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <LayersIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Standard map"
                onClick={() => setBasemap("standard")}
                className={`min-h-[36px] min-w-[44px] p-2 flex items-center justify-center border-t border-slate-700 transition-all cursor-pointer ${
                  basemap === "standard"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right side: Use My Location & Live Area */}
          <div className="flex flex-col items-end gap-2">

            {/* Use My Location button */}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="pointer-events-auto bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:text-slate-500 font-bold px-4 py-2.5 min-h-[44px] rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-700 shadow-sm"
            >
              {isLocating ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Navigation className="w-4 h-4 text-emerald-400" />
              )}
              {isLocating ? "Locating..." : "Use GPS Instead"}
            </button>

            {/* GPS accuracy indicator -- browser/device GPS, not survey-grade */}
            {gpsAccuracyM !== null && (
              <div
                title="Device/browser GPS estimate — not survey-grade (RTK) accuracy."
                className="pointer-events-none bg-slate-900/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[9px] text-blue-300 font-mono flex items-center gap-1"
              >
                <Crosshair className="w-3 h-3" />
                ±{Math.round(gpsAccuracyM)} m accuracy
              </div>
            )}

            {/* Live Area Readout */}
            <AnimatePresence>
              {isDrawing && liveArea !== null && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl border border-emerald-500/50 shadow-lg flex flex-col items-end pointer-events-none"
                >
                  <span className="text-[9px] text-emerald-400/80 font-bold uppercase tracking-wider">Live Area</span>
                  <div className="text-emerald-400 font-black font-mono mt-0.5">
                    <AnimatedCounter value={areaUnit === "hectares" ? acresToHectares(liveArea) : liveArea} decimals={2} />
                    <span className="ml-1 text-[10px] text-emerald-400/70">{areaUnit === "hectares" ? "ha" : "ac"}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>



        {/* Bottom coordinate overlay */}
        <div className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-500 z-[1000] pointer-events-none">
          WGS 84 / EPSG:4326 | {basemap === "satellite" ? "Satellite/aerial imagery" : "Standard map"} | Draw a polygon to map your boundary
        </div>
      </div>

      {/* GPS error warning */}
      <AnimatePresence>
        {gpsError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span className="font-semibold">{gpsError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Polygon validation error */}
      <AnimatePresence>
        {polygonError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 p-2.5 bg-red-50/80 border border-red-200 rounded-xl text-xs text-red-800"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            <span className="font-semibold">{polygonError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live area readout */}
      <AnimatePresence>
        {areaDisplay && !polygonError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 font-semibold">Computed Area:</span>
              <span className="font-black text-emerald-700">{areaDisplay}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                ✓ Valid boundary
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instruction hint */}
      {!areaDisplay && !polygonError && mapReady && (
        <p className="text-[10px] text-gray-400 font-semibold text-center py-1">
          Click the pen tool in the top-left corner of the map to start drawing your boundary
        </p>
      )}
    </div>
  );
};

export default LeafletMapPicker;
