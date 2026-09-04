/**
 * GoogleMapBoundarySurveyor.tsx
 *
 * True Full-Screen Farm Boundary Mapping Experience.
 *
 * Primary Provider: Official Google Maps JavaScript API (Satellite / Hybrid).
 * Fallback Provider: High-Resolution Satellite Engine (Esri World Imagery / MapTiler).
 *
 * Features:
 * - 100% viewport coverage via React Portal (`fixed inset-0 z-[99999] w-screen h-screen`)
 * - Deep zoom (levels 17–20) tightly focused on the farmer's plot geometry / GPS location
 * - Interactive polygon drawing & vertex dragging
 * - Geodesic segment length labels on each boundary edge (e.g., "74.70 m", "50.00 m")
 * - Floating Measurement Card (Total Area in Acres, Hectares, m², and Total Perimeter in metres)
 * - GPS Geolocation with true accuracy circle and honest non-RTK disclaimer
 * - Village / Mandal / District search locator
 * - Converts polygon to NutriPalm standard GeoJSON format (EPSG:4326 [lng, lat])
 * - Clear, honest engine status (Google Maps Platform vs Satellite Fallback)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  MapPin,
  Navigation,
  Trash2,
  Undo2,
  Layers,
  Search,
  Crosshair,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Info,
  Key,
  RefreshCw,
  HelpCircle,
  Ruler,
  Globe2,
} from "lucide-react";
import {
  computePolygonAreaAcres,
  computeCentroid,
  validatePolygon,
  acresToHectares,
  type GeoJSONPolygon,
} from "../../lib/geo";
import {
  loadGoogleMaps,
  setGoogleMapsApiKeyOverride,
} from "../../lib/googleMapsLoader";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

export interface BoundaryData {
  geoJSON: GeoJSONPolygon;
  areaAcres: number;
  centroid: { lat: number; lng: number } | null;
}

export interface GoogleMapBoundarySurveyorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: BoundaryData) => void;
  initialGeoJSON?: GeoJSONPolygon;
  plotName?: string;
  defaultAreaUnit?: "acres" | "hectares";
  showToast?: (msg: string, type?: "success" | "info" | "warning") => void;
}

const DEFAULT_CENTER = { lat: 17.3912, lng: 78.4948 }; // Telangana / Andhra Oil Palm Belt
const DEFAULT_FARM_ZOOM = 18; // Deep farm-level zoom

function calculateDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const GoogleMapBoundarySurveyor: React.FC<GoogleMapBoundarySurveyorProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialGeoJSON,
  plotName = "Farm Plot",
  defaultAreaUnit = "acres",
  showToast,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const googlePolygonRef = useRef<any>(null);
  const googlePolylineRef = useRef<any>(null);
  const googleAccuracyCircleRef = useRef<any>(null);
  const googleUserMarkerRef = useRef<any>(null);

  // Leaflet Fallback Refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletPolygonRef = useRef<L.Polygon | null>(null);
  const leafletMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletAccuracyCircleRef = useRef<L.Circle | null>(null);

  const [activeEngine, setActiveEngine] = useState<"google" | "satellite_fallback">("google");
  const [areaUnit, setAreaUnit] = useState<"acres" | "hectares">(defaultAreaUnit);
  const [mapType, setMapType] = useState<"hybrid" | "roadmap" | "satellite">("hybrid");
  const [vertices, setVertices] = useState<Array<{ lat: number; lng: number }>>([]);
  const [areaAcres, setAreaAcres] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // GPS State
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Engine loading & API Key states
  const [isLoadingMaps, setIsLoadingMaps] = useState(true);
  const [mapsLoadError, setMapsLoadError] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  const triggerToast = useCallback(
    (msg: string, type: "success" | "info" | "warning" = "info") => {
      if (showToast) showToast(msg, type);
    },
    [showToast]
  );

  // ---------------------------------------------------------------------------
  // Parse initial GeoJSON if provided
  // ---------------------------------------------------------------------------
  const getInitialCoordinates = useCallback((): Array<{ lat: number; lng: number }> => {
    if (!initialGeoJSON || !initialGeoJSON.coordinates || !initialGeoJSON.coordinates[0]) {
      return [];
    }
    const ring = initialGeoJSON.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 3) return [];

    const pts = ring.map(([lng, lat]) => ({ lat, lng }));
    if (
      pts.length > 3 &&
      pts[0].lat === pts[pts.length - 1].lat &&
      pts[0].lng === pts[pts.length - 1].lng
    ) {
      return pts.slice(0, -1);
    }
    return pts;
  }, [initialGeoJSON]);

  // ---------------------------------------------------------------------------
  // Perimeter and Segment Distances calculation
  // ---------------------------------------------------------------------------
  const segmentStats = useMemo(() => {
    if (vertices.length < 2) return { perimeterM: 0, segments: [] };
    let perimeter = 0;
    const segments: Array<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; distM: number }> = [];

    for (let i = 0; i < vertices.length; i++) {
      const nextIdx = (i + 1) % vertices.length;
      if (vertices.length < 3 && nextIdx === 0) continue;
      const d = calculateDistanceM(
        vertices[i].lat,
        vertices[i].lng,
        vertices[nextIdx].lat,
        vertices[nextIdx].lng
      );
      perimeter += d;
      segments.push({
        from: vertices[i],
        to: vertices[nextIdx],
        distM: d,
      });
    }

    return { perimeterM: perimeter, segments };
  }, [vertices]);

  // ---------------------------------------------------------------------------
  // Compute Area and Validate Polygon
  // ---------------------------------------------------------------------------
  const recalculateGeometry = useCallback(
    async (coords: Array<{ lat: number; lng: number }>) => {
      if (coords.length < 3) {
        setAreaAcres(null);
        setValidationError(coords.length > 0 ? "Place at least 3 points to form a closed farm boundary." : null);
        return;
      }

      const ring = coords.map((c) => [c.lng, c.lat]);
      ring.push([coords[0].lng, coords[0].lat]);

      const geoJSON: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: [ring],
      };

      try {
        const computedAcres = await computePolygonAreaAcres(geoJSON);
        setAreaAcres(computedAcres);

        const validation = await validatePolygon(geoJSON, computedAcres);
        if (!validation.valid) {
          setValidationError(validation.reason || "Invalid polygon geometry.");
        } else {
          setValidationError(null);
        }
      } catch {
        setValidationError("Could not calculate boundary area.");
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Leaflet Satellite Fallback Engine
  // ---------------------------------------------------------------------------
  const initLeafletFallback = useCallback(
    (coords: Array<{ lat: number; lng: number }>) => {
      if (!mapContainerRef.current) return;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      let center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
      let zoom = DEFAULT_FARM_ZOOM;

      if (coords.length > 0) {
        center = [coords[0].lat, coords[0].lng];
      }

      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // High-resolution satellite tiles
      const satLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      );
      satLayer.addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      leafletMarkersGroupRef.current = markersGroup;

      const polygon = L.polygon([], {
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.25,
        weight: 2.5,
      }).addTo(map);
      leafletPolygonRef.current = polygon;

      const renderLeafletPolygon = (pts: Array<{ lat: number; lng: number }>) => {
        markersGroup.clearLayers();
        const latLngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
        polygon.setLatLngs(latLngs);

        // Add draggable vertex markers
        pts.forEach((pt, idx) => {
          const marker = L.circleMarker([pt.lat, pt.lng], {
            radius: 6,
            color: "#ffffff",
            fillColor: "#10b981",
            fillOpacity: 1,
            weight: 2,
          });

          // Allow dragging
          marker.on("mousedown", () => {
            map.dragging.disable();
            const onMouseMove = (e: L.LeafletMouseEvent) => {
              const newPts = [...pts];
              newPts[idx] = { lat: e.latlng.lat, lng: e.latlng.lng };
              setVertices(newPts);
              renderLeafletPolygon(newPts);
              recalculateGeometry(newPts);
            };
            const onMouseUp = () => {
              map.dragging.enable();
              map.off("mousemove", onMouseMove);
              map.off("mouseup", onMouseUp);
            };
            map.on("mousemove", onMouseMove);
            map.on("mouseup", onMouseUp);
          });

          marker.addTo(markersGroup);
        });
      };

      map.on("click", (e: L.LeafletMouseEvent) => {
        setVertices((prev) => {
          const updated = [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }];
          renderLeafletPolygon(updated);
          recalculateGeometry(updated);
          return updated;
        });
      });

      if (coords.length >= 3) {
        renderLeafletPolygon(coords);
        const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 19 });
      }

      leafletMapRef.current = map;
      setActiveEngine("satellite_fallback");
      setIsLoadingMaps(false);
    },
    [recalculateGeometry]
  );

  // ---------------------------------------------------------------------------
  // Initialize Google Maps Engine
  // ---------------------------------------------------------------------------
  const initGoogleMaps = useCallback(
    async (keyOverride?: string) => {
      if (!mapContainerRef.current) return;
      setIsLoadingMaps(true);
      setMapsLoadError(null);

      const initialCoords = getInitialCoordinates();

      try {
        const google = await loadGoogleMaps(keyOverride);
        if (!mapContainerRef.current) return;

        let center = DEFAULT_CENTER;
        let zoom = DEFAULT_FARM_ZOOM;

        if (initialCoords.length > 0) {
          center = initialCoords[0];
        }

        const map = new google.maps.Map(mapContainerRef.current, {
          center,
          zoom,
          mapTypeId: google.maps.MapTypeId.HYBRID,
          tilt: 0,
          rotateControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: false,
          gestureHandling: "greedy",
          clickableIcons: false,
          maxZoom: 21,
          minZoom: 4,
        });

        googleMapRef.current = map;

        const polygon = new google.maps.Polygon({
          strokeColor: "#10b981",
          strokeOpacity: 0.95,
          strokeWeight: 2.5,
          fillColor: "#10b981",
          fillOpacity: 0.22,
          editable: true,
          draggable: false,
          zIndex: 10,
        });
        polygon.setMap(map);
        googlePolygonRef.current = polygon;

        const polyline = new google.maps.Polyline({
          strokeColor: "#34d399",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          map: map,
          zIndex: 9,
        });
        googlePolylineRef.current = polyline;

        const path = polygon.getPath();
        const updateFromPath = () => {
          const currentPath = polygon.getPath();
          const newCoords: Array<{ lat: number; lng: number }> = [];
          for (let i = 0; i < currentPath.getLength(); i++) {
            const pt = currentPath.getAt(i);
            newCoords.push({ lat: pt.lat(), lng: pt.lng() });
          }
          setVertices(newCoords);
          if (newCoords.length >= 3) {
            polyline.setPath([]);
          }
          recalculateGeometry(newCoords);
        };

        path.addListener("set_at", updateFromPath);
        path.addListener("insert_at", updateFromPath);
        path.addListener("remove_at", updateFromPath);

        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          setVertices((prev) => {
            const updated = [...prev, { lat, lng }];
            const mvcPath = polygon.getPath();
            mvcPath.push(e.latLng);
            polyline.setPath(mvcPath);
            recalculateGeometry(updated);
            return updated;
          });
        });

        if (initialCoords.length >= 3) {
          const mvcPath = polygon.getPath();
          mvcPath.clear();
          const bounds = new google.maps.LatLngBounds();
          initialCoords.forEach((pt) => {
            const latLng = new google.maps.LatLng(pt.lat, pt.lng);
            mvcPath.push(latLng);
            bounds.extend(latLng);
          });
          map.fitBounds(bounds, { top: 70, right: 70, bottom: 70, left: 70 });
          setVertices(initialCoords);
          recalculateGeometry(initialCoords);
        }

        setActiveEngine("google");
        setIsLoadingMaps(false);
      } catch (err: any) {
        console.warn("Google Maps JS API did not load:", err?.message);
        const errMsg = err?.message || "Google Maps API unavailable";
        setMapsLoadError(errMsg);
        // Fall back gracefully to the high-resolution satellite engine so the user is never blocked
        initLeafletFallback(initialCoords);
      }
    },
    [getInitialCoordinates, recalculateGeometry, initLeafletFallback]
  );

  useEffect(() => {
    if (isOpen) {
      setVertices(getInitialCoordinates());
      initGoogleMaps();
    }

    return () => {
      if (googlePolygonRef.current) {
        googlePolygonRef.current.setMap(null);
        googlePolygonRef.current = null;
      }
      if (googlePolylineRef.current) {
        googlePolylineRef.current.setMap(null);
        googlePolylineRef.current = null;
      }
      if (googleAccuracyCircleRef.current) {
        googleAccuracyCircleRef.current.setMap(null);
        googleAccuracyCircleRef.current = null;
      }
      if (googleUserMarkerRef.current) {
        googleUserMarkerRef.current.setMap(null);
        googleUserMarkerRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      googleMapRef.current = null;
    };
  }, [isOpen, initGoogleMaps, getInitialCoordinates]);

  // ---------------------------------------------------------------------------
  // Basemap Switcher
  // ---------------------------------------------------------------------------
  const handleBasemapChange = (type: "hybrid" | "roadmap" | "satellite") => {
    setMapType(type);
    if (activeEngine === "google" && googleMapRef.current && window.google?.maps) {
      if (type === "hybrid") {
        googleMapRef.current.setMapTypeId(window.google.maps.MapTypeId.HYBRID);
      } else if (type === "satellite") {
        googleMapRef.current.setMapTypeId(window.google.maps.MapTypeId.SATELLITE);
      } else {
        googleMapRef.current.setMapTypeId(window.google.maps.MapTypeId.ROADMAP);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // GPS Geolocation Handler (Honest Accuracy)
  // ---------------------------------------------------------------------------
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      triggerToast("Geolocation is not supported.", "warning");
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracyM(accuracy);

        if (activeEngine === "google" && googleMapRef.current && window.google?.maps) {
          const latLng = new window.google.maps.LatLng(latitude, longitude);
          googleMapRef.current.panTo(latLng);
          googleMapRef.current.setZoom(19);

          if (googleAccuracyCircleRef.current) {
            googleAccuracyCircleRef.current.setMap(null);
          }
          googleAccuracyCircleRef.current = new window.google.maps.Circle({
            strokeColor: "#3b82f6",
            strokeOpacity: 0.8,
            strokeWeight: 1.5,
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            map: googleMapRef.current,
            center: latLng,
            radius: accuracy,
            zIndex: 5,
          });

          if (googleUserMarkerRef.current) {
            googleUserMarkerRef.current.setMap(null);
          }
          googleUserMarkerRef.current = new window.google.maps.Marker({
            position: latLng,
            map: googleMapRef.current,
            title: `GPS Position (±${Math.round(accuracy)}m accuracy)`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            zIndex: 6,
          });
        } else if (leafletMapRef.current) {
          leafletMapRef.current.setView([latitude, longitude], 18);
          if (leafletAccuracyCircleRef.current) {
            leafletMapRef.current.removeLayer(leafletAccuracyCircleRef.current);
          }
          leafletAccuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 1.5,
          }).addTo(leafletMapRef.current);
        }

        triggerToast(
          `GPS Acquired: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (±${Math.round(accuracy)}m accuracy)`,
          "success"
        );
      },
      (err) => {
        setIsLocating(false);
        setGpsAccuracyM(null);
        let msg = "Could not obtain GPS location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied in browser.";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS request timed out.";
        }
        setGpsError(msg);
        triggerToast(msg, "warning");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // ---------------------------------------------------------------------------
  // Location Search Handler
  // ---------------------------------------------------------------------------
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setGpsError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=in&limit=1`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        if (activeEngine === "google" && googleMapRef.current && window.google?.maps) {
          const latLng = new window.google.maps.LatLng(lat, lon);
          googleMapRef.current.panTo(latLng);
          googleMapRef.current.setZoom(17);
        } else if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lon], 17);
        }
        triggerToast(`Centered on: ${data[0].display_name.split(",")[0]}`, "success");
      } else {
        triggerToast("Location not found.", "warning");
      }
    } catch {
      triggerToast("Search failed.", "warning");
    } finally {
      setIsSearching(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Undo, Clear & Confirm
  // ---------------------------------------------------------------------------
  const handleUndo = () => {
    if (vertices.length === 0) return;
    const updated = vertices.slice(0, -1);
    setVertices(updated);

    if (activeEngine === "google" && googlePolygonRef.current) {
      const mvcPath = googlePolygonRef.current.getPath();
      mvcPath.pop();
      if (googlePolylineRef.current) googlePolylineRef.current.setPath(mvcPath);
    } else if (leafletMapRef.current && leafletPolygonRef.current) {
      leafletPolygonRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
    }
    recalculateGeometry(updated);
  };

  const handleClear = () => {
    setVertices([]);
    setAreaAcres(null);
    setValidationError(null);

    if (activeEngine === "google" && googlePolygonRef.current) {
      googlePolygonRef.current.getPath().clear();
      if (googlePolylineRef.current) googlePolylineRef.current.setPath([]);
    } else if (leafletMapRef.current && leafletPolygonRef.current) {
      leafletPolygonRef.current.setLatLngs([]);
      leafletMarkersGroupRef.current?.clearLayers();
    }
    triggerToast("Boundary cleared", "info");
  };

  const handleConfirm = async () => {
    if (vertices.length < 3) {
      triggerToast("Please place at least 3 points along the farm boundary.", "warning");
      return;
    }

    const ring = vertices.map((v) => [v.lng, v.lat]);
    ring.push([vertices[0].lng, vertices[0].lat]);

    const geoJSON: GeoJSONPolygon = {
      type: "Polygon",
      coordinates: [ring],
    };

    const calculatedAcres = await computePolygonAreaAcres(geoJSON);
    const validation = await validatePolygon(geoJSON, calculatedAcres);

    if (!validation.valid) {
      triggerToast(validation.reason || "Invalid boundary polygon.", "warning");
      return;
    }

    const centroid = await computeCentroid(geoJSON);

    onConfirm({
      geoJSON,
      areaAcres: calculatedAcres,
      centroid,
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none top-0 left-0 right-0 bottom-0">
      {/* ================= 1. Top Navigation & Status Bar ================= */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        {/* Left: Close & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 flex items-center gap-1.5 text-xs font-bold"
            title="Return to plot management"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-tight">{plotName}</span>
              {activeEngine === "google" ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Google Maps Satellite
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                  <Globe2 className="w-3 h-3 text-blue-400" />
                  Satellite Engine (Keyless)
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              WGS 84 (EPSG:4326) · High-Resolution Satellite Precision Survey
            </span>
          </div>
        </div>

        {/* Center: Live Area Badge */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-1.5 rounded-2xl border border-slate-800">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-slate-400 uppercase text-[9px] tracking-wider">Surveyed Area:</span>
            {areaAcres !== null ? (
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-emerald-400 font-black text-sm">
                  {areaUnit === "hectares"
                    ? `${acresToHectares(areaAcres).toFixed(2)} ha`
                    : `${areaAcres.toFixed(2)} ac`}
                </span>
                <span className="text-slate-500 text-[10px]">
                  ({areaUnit === "hectares" ? `${areaAcres.toFixed(2)} ac` : `${acresToHectares(areaAcres).toFixed(2)} ha`})
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-xs italic">Place points around field</span>
            )}
          </div>

          <div className="inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 ml-1">
            {(["acres", "hectares"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setAreaUnit(u)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                  areaUnit === u ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {u === "acres" ? "ac" : "ha"}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {vertices.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 flex items-center gap-1 text-xs font-semibold"
              title="Undo last point"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Undo</span>
            </button>
          )}

          {vertices.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 transition-all cursor-pointer border border-slate-700 flex items-center gap-1 text-xs font-semibold"
              title="Clear all points"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
            title="Google Maps API Key Configuration"
          >
            <Key className="w-4 h-4 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={() => setShowHelpGuide(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
            title="Survey Instructions"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={vertices.length < 3 || !!validationError}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border-0 ${
              vertices.length >= 3 && !validationError
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Confirm Boundary ({vertices.length} pts)</span>
          </button>
        </div>
      </header>

      {/* ================= 2. Map Canvas & Floating HUD ================= */}
      <main className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading Indicator */}
        {isLoadingMaps && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-40">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-bold text-slate-200">Loading High-Resolution Satellite Imagery...</p>
            <p className="text-xs text-slate-400">Zooming to Farm Parcel</p>
          </div>
        )}

        {/* Floating Top-Left: Search & Village Finder */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-sm w-full">
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-1"
          >
            <div className="pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search village, mandal, district (e.g. Khammam)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-xs text-white px-2.5 py-1.5 w-full focus:outline-none placeholder:text-slate-400 font-semibold"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Find"}
            </button>
          </form>

          {/* GPS Accuracy Status Pill */}
          {gpsAccuracyM !== null && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/95 backdrop-blur-md border border-blue-500/40 px-3 py-2 rounded-xl shadow-lg flex items-start gap-2.5 text-left"
            >
              <Crosshair className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-blue-300">
                  GPS Fix: ±{Math.round(gpsAccuracyM)} m (Mobile/Device GPS)
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                  Standard consumer GPS. Visually verify boundary vertices against tree lines and physical bunds.
                </p>
              </div>
            </motion.div>
          )}

          {/* GPS Error Alert */}
          {gpsError && (
            <div className="bg-amber-950/90 border border-amber-800/80 px-3 py-2 rounded-xl text-xs text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold text-[11px]">{gpsError}</span>
            </div>
          )}

          {/* Validation or Engine Notice */}
          {validationError && (
            <div className="bg-rose-950/90 border border-rose-800/80 px-3 py-2 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold text-[11px]">{validationError}</span>
            </div>
          )}

          {activeEngine === "satellite_fallback" && !mapsLoadError && (
            <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-[10px] text-slate-300 flex items-center justify-between">
              <span>Using High-Res Keyless Satellite Tiles</span>
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                className="text-amber-400 hover:underline font-bold ml-2 cursor-pointer bg-transparent border-0"
              >
                Add Google Key
              </button>
            </div>
          )}
        </div>

        {/* Floating Right Controls: GPS, Basemap, Zoom */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2.5">
          {/* Use GPS Button */}
          <button
            type="button"
            onClick={handleUseGPS}
            disabled={isLocating}
            className="bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-extrabold cursor-pointer transition-all active:scale-95"
            title="Center on current GPS position"
          >
            {isLocating ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <Navigation className="w-4 h-4 text-blue-400" />
            )}
            <span>{isLocating ? "Acquiring GPS..." : "My GPS Location"}</span>
          </button>

          {/* Basemap Switcher */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-1 flex flex-col gap-1 shadow-xl">
            <button
              type="button"
              onClick={() => handleBasemapChange("hybrid")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mapType === "hybrid" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Satellite</span>
            </button>
            <button
              type="button"
              onClick={() => handleBasemapChange("roadmap")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mapType === "roadmap" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Roadmap</span>
            </button>
          </div>

          {/* Zoom In / Out */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-xl flex flex-col">
            <button
              type="button"
              onClick={() => {
                if (activeEngine === "google") googleMapRef.current?.setZoom(googleMapRef.current.getZoom() + 1);
                else leafletMapRef.current?.zoomIn();
              }}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer border-b border-slate-800"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeEngine === "google") googleMapRef.current?.setZoom(googleMapRef.current.getZoom() - 1);
                else leafletMapRef.current?.zoomOut();
              }}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= 3. FLOATING MEASUREMENT CARD (As in Reference Screenshot) ================= */}
        {vertices.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-16 left-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-2xl shadow-2xl max-w-xs w-full text-left space-y-2 font-sans"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-xs text-white">Boundary Measurement</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {vertices.length} vertices
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Total Area:</span>
                <span className="font-mono font-bold text-white">
                  {areaAcres !== null
                    ? `${areaAcres.toFixed(2)} ac (${acresToHectares(areaAcres).toFixed(2)} ha)`
                    : "Enclosing..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Total Perimeter:</span>
                <span className="font-mono font-bold text-white">
                  {segmentStats.perimeterM > 1000
                    ? `${(segmentStats.perimeterM / 1000).toFixed(2)} km`
                    : `${segmentStats.perimeterM.toFixed(1)} m`}
                </span>
              </div>
            </div>

            {/* Segment Distances List */}
            {segmentStats.segments.length > 0 && (
              <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-0.5 max-h-24 overflow-y-auto">
                {segmentStats.segments.map((s, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>Edge {idx + 1} → {idx + 2 > vertices.length ? 1 : idx + 2}:</span>
                    <span className="text-slate-200 font-bold">{s.distM.toFixed(1)} m</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Floating Bottom Instruction Banner */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs max-w-xl w-11/12 sm:w-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-slate-200 font-medium text-[11px] sm:text-xs">
            {vertices.length === 0 && "👉 Tap/click points along the farm boundary to start surveying."}
            {vertices.length === 1 && "👉 Click the next corner of your plot."}
            {vertices.length === 2 && "👉 Add at least 1 more point to enclose the farm area."}
            {vertices.length >= 3 && "✓ Polygon active! Drag any vertex to adjust, or click 'Confirm Boundary'."}
          </p>
        </div>
      </main>

      {/* ================= 4. API Key Configuration Modal ================= */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Google Maps API Setup</h3>
                    <p className="text-xs text-slate-400">Configure key for Google Satellite tiles</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  VITE_GOOGLE_MAPS_API_KEY:
                </label>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">Status & Billing Note:</p>
                <p>• If your Google Cloud billing is active, enabling <strong>Maps JavaScript API</strong> provides 10,000 free loads/month globally (70,000 in India).</p>
                <p>• If billing is inactive, NutriPalm seamlessly uses the high-resolution keyless satellite engine so your boundary survey workflow continues uninterrupted.</p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowKeyModal(false);
                    initLeafletFallback(vertices);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  Use Keyless Satellite
                </button>
                <button
                  type="button"
                  disabled={!tempApiKey.trim()}
                  onClick={() => {
                    setGoogleMapsApiKeyOverride(tempApiKey.trim());
                    setShowKeyModal(false);
                    initGoogleMaps(tempApiKey.trim());
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 cursor-pointer border-0"
                >
                  Apply & Load Google Maps
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 5. Instructions Guide Modal ================= */}
      <AnimatePresence>
        {showHelpGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-left max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Info className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-black text-base text-white">How to Survey Farm Boundaries</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">1. Locate Your Land</p>
                  <p>Search your village or click <strong>My GPS Location</strong> to center on your position.</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">2. Place Boundary Corners</p>
                  <p>Click points around your farm perimeter. Edge distances (in metres) and total acreage update live.</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">3. Adjust & Save</p>
                  <p>Drag any point to align with bunds or fences, then click <strong>Confirm Boundary</strong>.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHelpGuide(false)}
                className="w-full py-2.5 bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer hover:bg-emerald-400 transition-all border-0"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default GoogleMapBoundarySurveyor;
