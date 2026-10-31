/**
 * BoundarySurveyor.tsx
 *
 * Full-screen farm boundary surveyor, Leaflet only. A precise, intuitive 4-step workflow:
 * 1. FIND FARM       (search a village/town/area OR use the device's location)
 * 2. DRAW BOUNDARY   (tap the farm corners on the satellite imagery)
 * 3. ADJUST BOUNDARY (drag corners, add one between two corners, undo, clear with confirmation, live lengths)
 * 4. CONFIRM & SAVE  (area + perimeter summary, validation, standard GeoJSON out)
 *
 * One map engine (Leaflet) and ONE imagery provider, configured in src/lib/mapConfig.ts. If that provider cannot be used the
 * surveyor says so and offers a Retry; it never switches provider. Device location comes from src/lib/geolocation.ts and is
 * reported with the accuracy the device claims - a phone GPS fix is not survey-grade.
 */

import { useTranslation } from "../../translation/useTranslation";
import { renderRich } from "../../translation/richText";
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
  Search,
  Crosshair,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Info,
  RefreshCw,
  HelpCircle,
  Ruler,
  Layers,
  Edit3,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import {
  computePolygonAreaAcres,
  computeCentroid,
  validatePolygon,
  acresToHectares,
  type GeoJSONPolygon,
} from "../../lib/geo";
import { getMapConfig } from "../../lib/mapConfig";
import { addConfiguredImagery } from "../../lib/imageryLayer";
import {
  acquireLocation,
  checkLocationSupport,
  queryLocationPermission,
  LocationError,
  type LocationErrorCode,
  type LocationFix,
  type LocationRequest,
} from "../../lib/geolocation";
import type { TileHealth } from "../../lib/tileHealth";
import { MapImageryNotice } from "./MapImageryNotice";

import "leaflet/dist/leaflet.css";
import "../../styles/survey-map.css";
import L from "leaflet";

export interface BoundaryData {
  geoJSON: GeoJSONPolygon;
  areaAcres: number;
  centroid: { lat: number; lng: number } | null;
}

export interface BoundarySurveyorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: BoundaryData) => void;
  initialGeoJSON?: GeoJSONPolygon;
  plotName?: string;
  defaultAreaUnit?: "acres" | "hectares";
  showToast?: (msg: string, type?: "success" | "info" | "warning") => void;
}

const DEFAULT_CENTER = { lat: 17.3912, lng: 78.4948 }; // Andhra Pradesh / Telangana Oil Palm Belt
const DEFAULT_FARM_ZOOM = 18;

// Popular agricultural presets for one-tap locating
const QUICK_LOCATIONS = [
  { name: "Khammam", lat: 17.2473, lng: 80.1514, desc: "Telangana Oil Palm Belt" },
  { name: "Eluru", lat: 16.7107, lng: 81.0952, desc: "Andhra Pradesh Palm Belt" },
  { name: "Pedavegi", lat: 16.8083, lng: 81.1274, desc: "West Godavari ICAR-IIOPR" },
  { name: "Chintalapudi", lat: 17.0673, lng: 80.9983, desc: "Eluru District" },
  { name: "Kothagudem", lat: 17.5521, lng: 80.6186, desc: "Bhadradri District" },
  { name: "Suryapet", lat: 17.1439, lng: 79.6239, desc: "Telangana" },
];

type SurveyStep = "find" | "draw" | "adjust" | "confirm";
type LatLng = { lat: number; lng: number };

interface SearchSuggestion {
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
}

function calculateDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Zoom that suits the accuracy the device reports (a coarse fix is not worth a close-up). */
function zoomForAccuracy(accuracyM: number): number {
  if (accuracyM > 500) return 15;
  if (accuracyM > 150) return 17;
  if (accuracyM > 30) return 18;
  return 19;
}

export const BoundarySurveyor: React.FC<BoundarySurveyorProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialGeoJSON,
  plotName = "Farm Plot",
  defaultAreaUnit = "acres",
  showToast,
}) => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // The single imagery configuration for this build (or the reason imagery is not enabled).
  const mapConfig = useMemo(() => getMapConfig(), []);

  // Leaflet objects
  const mapRef = useRef<L.Map | null>(null);
  const tileHealthRef = useRef<TileHealth | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const handlesRef = useRef<L.LayerGroup | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);

  // Device location request in flight (cancelled on retry, close and unmount)
  const locationRequestRef = useRef<LocationRequest | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [currentStep, setCurrentStep] = useState<SurveyStep>("find");
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  const [areaUnit, setAreaUnit] = useState<"acres" | "hectares">(defaultAreaUnit);
  const [vertices, setVertices] = useState<LatLng[]>([]);
  const [areaAcres, setAreaAcres] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Device location
  const [isLocating, setIsLocating] = useState(false);
  const [interimAccuracyM, setInterimAccuracyM] = useState<number | null>(null);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);
  const [gpsError, setGpsError] = useState<{ code: LocationErrorCode; message: string } | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  // Place search
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [locationFoundNotice, setLocationFoundNotice] = useState<string | null>(null);

  // Modals & map status
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(true);
  const [tilesFailing, setTilesFailing] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const triggerToast = useCallback(
    (msg: string, type: "success" | "info" | "warning" = "info") => {
      if (showToast) showToast(msg, type);
    },
    [showToast]
  );

  // Event handlers registered on Leaflet read these refs, not stale closures.
  const isDrawingActiveRef = useRef(isDrawingActive);
  useEffect(() => {
    isDrawingActiveRef.current = isDrawingActive;
  }, [isDrawingActive]);

  const verticesRef = useRef(vertices);
  useEffect(() => {
    verticesRef.current = vertices;
  }, [vertices]);

  // True while a corner is being dragged: the polygon follows the finger, but the handles are not rebuilt under it.
  const draggingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Parse initial GeoJSON if provided (re-survey of an existing plot)
  // ---------------------------------------------------------------------------
  const getInitialCoordinates = useCallback((): LatLng[] => {
    if (!initialGeoJSON || !initialGeoJSON.coordinates || !initialGeoJSON.coordinates[0]) return [];
    const ring = initialGeoJSON.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 3) return [];
    const pts = ring.map(([lng, lat]) => ({ lat, lng }));
    if (pts.length > 3 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lng === pts[pts.length - 1].lng) {
      return pts.slice(0, -1);
    }
    return pts;
  }, [initialGeoJSON]);

  // ---------------------------------------------------------------------------
  // Geometry & distance calculations
  // ---------------------------------------------------------------------------
  const segmentStats = useMemo(() => {
    if (vertices.length < 2) return { perimeterM: 0, segments: [] as Array<{ from: LatLng; to: LatLng; distM: number }> };
    let perimeter = 0;
    const segments: Array<{ from: LatLng; to: LatLng; distM: number }> = [];
    for (let i = 0; i < vertices.length; i++) {
      const nextIdx = (i + 1) % vertices.length;
      if (vertices.length < 3 && nextIdx === 0) continue;
      const d = calculateDistanceM(vertices[i].lat, vertices[i].lng, vertices[nextIdx].lat, vertices[nextIdx].lng);
      perimeter += d;
      segments.push({ from: vertices[i], to: vertices[nextIdx], distM: d });
    }
    return { perimeterM: perimeter, segments };
  }, [vertices]);

  const recalculateGeometry = useCallback(
    async (coords: LatLng[], isCancelled: () => boolean = () => false) => {
      if (coords.length < 3) {
        setAreaAcres(null);
        setValidationError(coords.length > 0 ? "Place at least 3 points to form a closed farm boundary." : null);
        return;
      }
      const ring = coords.map((c) => [c.lng, c.lat]);
      ring.push([coords[0].lng, coords[0].lat]);
      const geoJSON: GeoJSONPolygon = { type: "Polygon", coordinates: [ring] };
      try {
        const computedAcres = await computePolygonAreaAcres(geoJSON);
        const validation = await validatePolygon(geoJSON, computedAcres);
        if (isCancelled()) return; // a newer edit superseded this one
        setAreaAcres(computedAcres);
        setValidationError(validation.valid ? null : validation.reason || "Invalid polygon geometry.");
      } catch {
        if (!isCancelled()) setValidationError(t("p2.toast.area_failed"));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Area, perimeter and validation always follow the vertex list (whatever changed it).
  useEffect(() => {
    let cancelled = false;
    recalculateGeometry(vertices, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [vertices, recalculateGeometry]);

  // ---------------------------------------------------------------------------
  // Overlay rendering: polygon, in-progress line, and touch-friendly corner handles.
  // The vertex list is the single source of truth; this effect draws it.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const polygon = polygonRef.current;
    const polyline = polylineRef.current;
    const handles = handlesRef.current;
    if (!mapReady || !map || !polygon || !polyline || !handles) return;

    const pts = vertices;
    const latLngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length >= 3) {
      polygon.setLatLngs(latLngs);
      polyline.setLatLngs([]);
    } else {
      polygon.setLatLngs([]);
      polyline.setLatLngs(latLngs);
    }
    if (draggingRef.current) return; // do not rebuild the handle being dragged

    handles.clearLayers();

    // Corner handles: a 44px touch target around a small visible dot.
    pts.forEach((pt, idx) => {
      const marker = L.marker([pt.lat, pt.lng], {
        draggable: true,
        keyboard: false,
        bubblingMouseEvents: false,
        alt: t("p5.survey.vertex_label", { n: idx + 1 }),
        icon: L.divIcon({
          className: "survey-vertex",
          html: `<span role="img" aria-label="${t("p5.survey.vertex_label", { n: idx + 1 })}"></span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        zIndexOffset: 500,
      });
      marker.on("dragstart", () => {
        draggingRef.current = true;
      });
      marker.on("drag", () => {
        const ll = marker.getLatLng();
        const next = verticesRef.current.slice();
        next[idx] = { lat: ll.lat, lng: ll.lng };
        setVertices(next);
      });
      marker.on("dragend", () => {
        draggingRef.current = false;
        setVertices((prev) => prev.slice()); // new array -> handles are rebuilt around the final positions
      });
      // Remove a corner (double-tap / double-click / right-click), but never below a triangle.
      const removeCorner = (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e as unknown as Event);
        if (verticesRef.current.length > 3) setVertices((prev) => prev.filter((_, i) => i !== idx));
      };
      marker.on("dblclick", removeCorner);
      marker.on("contextmenu", removeCorner);
      marker.addTo(handles);
    });

    // Midpoint handles: tap to add a corner between two corners (only while adjusting, not while placing points).
    if (pts.length >= 3 && !isDrawingActive) {
      pts.forEach((pt, idx) => {
        const next = pts[(idx + 1) % pts.length];
        const mid = L.marker([(pt.lat + next.lat) / 2, (pt.lng + next.lng) / 2], {
          keyboard: false,
          bubblingMouseEvents: false,
          alt: t("p5.survey.midpoint_label", { n: idx + 1 }),
          icon: L.divIcon({
            className: "survey-midpoint",
            html: `<span role="img" aria-label="${t("p5.survey.midpoint_label", { n: idx + 1 })}"></span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        });
        mid.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          setVertices((prev) => {
            const a = prev[idx];
            const b = prev[(idx + 1) % prev.length];
            const copy = prev.slice();
            copy.splice(idx + 1, 0, { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });
            return copy;
          });
        });
        mid.addTo(handles);
      });
    }
  }, [vertices, mapReady, isDrawingActive, t]);

  // Double-click must not zoom the map while the farmer is tapping out corners.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (isDrawingActive) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [isDrawingActive, mapReady]);

  // ---------------------------------------------------------------------------
  // Move the map to a place (search result / preset)
  // ---------------------------------------------------------------------------
  const navigateMapToCoordinates = useCallback(
    (lat: number, lng: number, placeName: string, zoomLevel = 18) => {
      setLocationFoundNotice(`📍 Located: ${placeName}`);
      setShowSuggestionsDropdown(false);
      const map = mapRef.current;
      if (map) {
        map.setView([lat, lng], zoomLevel);
        if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
        searchMarkerRef.current = L.marker([lat, lng], {
          keyboard: false,
          icon: L.divIcon({ className: "survey-search-pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }),
        }).addTo(map);
      }
      triggerToast(`Centered on: ${placeName}. Tap 'Draw Farm Boundary' when ready.`, "success");
    },
    [triggerToast]
  );

  // ---------------------------------------------------------------------------
  // Map lifecycle: create the Leaflet map with the ONE configured imagery layer
  // ---------------------------------------------------------------------------
  const stopLocationRequest = useCallback(() => {
    locationRequestRef.current?.cancel();
    locationRequestRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const initial = getInitialCoordinates();
    setVertices(initial);
    setAreaAcres(null);
    setValidationError(null);
    setTilesFailing(false);
    setGpsError(null);
    setGpsWarning(null);
    setGpsAccuracyM(null);
    setCurrentLocation(null);
    setLocationFoundNotice(null);
    setCurrentStep(initial.length >= 3 ? "adjust" : "find");
    setIsDrawingActive(false);

    // Imagery not enabled / badly configured: say so. No map, and no other source, is substituted.
    if (!mapConfig.ok) {
      setIsLoadingMaps(false);
      return;
    }
    const container = mapContainerRef.current;
    if (!container) return;
    setIsLoadingMaps(true);

    const cfg = mapConfig.config;
    const map = L.map(container, {
      center: initial.length > 0 ? [initial[0].lat, initial[0].lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: DEFAULT_FARM_ZOOM,
      zoomControl: false,
      attributionControl: true,
      maxZoom: cfg.maxZoom,
    });

    const { layer, health } = addConfiguredImagery(map, cfg, setTilesFailing);
    tileHealthRef.current = health;
    let settled = false;
    const finishLoading = () => {
      settled = true;
      setIsLoadingMaps(false);
    };
    layer.once("load", finishLoading);
    const safety = window.setTimeout(() => {
      if (!settled) finishLoading();
    }, 12000);

    polygonRef.current = L.polygon([], { color: "#10b981", fillColor: "#10b981", fillOpacity: 0.3, weight: 3 }).addTo(map);
    polylineRef.current = L.polyline([], { color: "#34d399", weight: 2.5, dashArray: "4, 6" }).addTo(map);
    handlesRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!isDrawingActiveRef.current) return;
      const { lat, lng } = e.latlng;
      setVertices((prev) => [...prev, { lat, lng }]);
      setCurrentStep(verticesRef.current.length + 1 >= 3 ? "adjust" : "draw");
    });

    if (initial.length >= 3) {
      map.fitBounds(L.latLngBounds(initial.map((c) => [c.lat, c.lng] as [number, number])), { padding: [60, 60], maxZoom: 19 });
    }

    mapRef.current = map;
    setMapReady(true);

    return () => {
      window.clearTimeout(safety);
      stopLocationRequest();
      tileHealthRef.current?.dispose();
      tileHealthRef.current = null;
      map.remove();
      mapRef.current = null;
      polygonRef.current = null;
      polylineRef.current = null;
      handlesRef.current = null;
      accuracyCircleRef.current = null;
      userMarkerRef.current = null;
      searchMarkerRef.current = null;
      draggingRef.current = false;
      setMapReady(false);
    };
    // The map is created once per opening; vertices and callbacks are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mapConfig]);

  // Keyboard shortcuts (Escape to close, Ctrl+Z to undo)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showClearConfirm) setShowClearConfirm(false);
        else if (showConfirmModal) setShowConfirmModal(false);
        else if (showHelpGuide) setShowHelpGuide(false);
        else onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, showClearConfirm, showConfirmModal, showHelpGuide, onClose]);

  const formattedLocationTime = useMemo(() => {
    if (!currentLocation?.timestamp) return null;
    return new Date(currentLocation.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [currentLocation]);

  // ---------------------------------------------------------------------------
  // 1. FIND FARM: device location
  // ---------------------------------------------------------------------------
  const clearLocationOverlay = useCallback(() => {
    const map = mapRef.current;
    if (map && accuracyCircleRef.current) map.removeLayer(accuracyCircleRef.current);
    if (map && userMarkerRef.current) map.removeLayer(userMarkerRef.current);
    accuracyCircleRef.current = null;
    userMarkerRef.current = null;
  }, []);

  const applyLocationFix = useCallback(
    (fix: LocationFix) => {
      setIsLocating(false);
      setInterimAccuracyM(null);
      setCurrentLocation({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracyM, timestamp: fix.timestamp });
      setGpsAccuracyM(fix.accuracyM);

      const map = mapRef.current;
      if (map) {
        clearLocationOverlay();
        map.setView([fix.lat, fix.lng], zoomForAccuracy(fix.accuracyM));
        const color = fix.accuracyM > 100 ? "#f59e0b" : "#3b82f6";
        accuracyCircleRef.current = L.circle([fix.lat, fix.lng], {
          radius: fix.accuracyM,
          color,
          fillColor: color,
          fillOpacity: 0.15,
          weight: 1.5,
          interactive: false,
        }).addTo(map);
        userMarkerRef.current = L.circleMarker([fix.lat, fix.lng], {
          radius: 8,
          color: "#ffffff",
          fillColor: fix.accuracyM > 100 ? "#f59e0b" : "#2563eb",
          fillOpacity: 1,
          weight: 2.5,
          interactive: false,
        }).addTo(map);
      }

      if (fix.accuracyM > 100) {
        setGpsWarning("Your location accuracy is low. Move outdoors or enable device location services and try again.");
        triggerToast(`Low accuracy (±${Math.round(fix.accuracyM)} m). Move outdoors or search your village name above.`, "warning");
      } else {
        setGpsWarning(null);
        triggerToast(`Location acquired (±${Math.round(fix.accuracyM)} m). Move to your farm and tap Draw Boundary.`, "success");
      }
    },
    [clearLocationOverlay, triggerToast]
  );

  const locationMessage = useCallback(
    async (code: LocationErrorCode): Promise<string> => {
      switch (code) {
        case "permission_denied":
          // When the browser reports "denied" it will not ask again: the person has to re-enable it in settings.
          return (await queryLocationPermission()) === "denied" ? t("p5.gps.denied_blocked") : t("p5.gps.denied");
        case "unavailable":
          return t("p5.gps.unavailable");
        case "timeout":
          return t("p5.gps.timeout");
        case "stale_fix":
          return t("p5.gps.stale");
        case "unsupported":
          return t("p5.gps.unsupported");
        case "insecure_context":
          return t("p5.gps.insecure");
      }
    },
    [t]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    // A retry replaces any request still running, and clears the previous fix so nothing stale stays on the map.
    stopLocationRequest();
    clearLocationOverlay();
    setGpsError(null);
    setGpsWarning(null);
    setGpsAccuracyM(null);
    setInterimAccuracyM(null);

    const unsupported = checkLocationSupport();
    if (unsupported) {
      const message = await locationMessage(unsupported.code);
      setGpsError({ code: unsupported.code, message });
      triggerToast(message, "warning");
      return;
    }

    setIsLocating(true);
    const request = acquireLocation({
      targetAccuracyM: 30,
      windowMs: 10000,
      onReading: (fix) => setInterimAccuracyM(fix.accuracyM),
    });
    locationRequestRef.current = request;
    try {
      const fix = await request.promise;
      if (locationRequestRef.current !== request) return; // superseded by a newer attempt
      locationRequestRef.current = null;
      applyLocationFix(fix);
    } catch (err) {
      if (locationRequestRef.current !== request) return;
      locationRequestRef.current = null;
      setIsLocating(false);
      setInterimAccuracyM(null);
      const code: LocationErrorCode = err instanceof LocationError ? err.code : "unavailable";
      const message = await locationMessage(code);
      setGpsError({ code, message });
      triggerToast(message, "warning");
    }
  }, [applyLocationFix, clearLocationOverlay, locationMessage, stopLocationRequest, triggerToast]);

  // ---------------------------------------------------------------------------
  // 1. FIND FARM: place search (OpenStreetMap Nominatim; unchanged behaviour)
  // ---------------------------------------------------------------------------
  const handleSearchInputChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim() || val.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestionsDropdown(false);
      return;
    }
    try {
      // Prioritize India by searching with countrycodes=in
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}&countrycodes=in&addressdetails=1&limit=5`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const formatted: SearchSuggestion[] = data.map((d: { display_name: string; lat: string; lon: string; type?: string }) => ({
          displayName: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          type: d.type,
        }));
        setSearchSuggestions(formatted);
        setShowSuggestionsDropdown(true);
      } else {
        setSearchSuggestions([]);
      }
    } catch {
      // Ignore background suggestion network errors
    }
  };

  const searchPlaces = async (query: string) => {
    try {
      let res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&addressdetails=1&limit=5`
      );
      let data = await res.json();
      if (!data || data.length === 0) {
        res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        data = await res.json();
      }
      if (data && data.length > 0) {
        navigateMapToCoordinates(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name.split(",")[0], 18);
      } else {
        triggerToast("Location not found. Try entering a nearby town or mandal name.", "warning");
      }
    } catch {
      triggerToast("Search connection failed. Please check internet connection.", "warning");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setGpsError(null);
    setShowSuggestionsDropdown(false);
    await searchPlaces(searchQuery.trim());
  };

  // ---------------------------------------------------------------------------
  // 2. START DRAWING
  // ---------------------------------------------------------------------------
  const handleStartDrawing = () => {
    if (!mapRef.current) return; // no imagery, nothing to draw on
    setIsDrawingActive(true);
    setCurrentStep(vertices.length >= 3 ? "adjust" : "draw");
    triggerToast("Drawing Mode Active! Click on the satellite map to add boundary points.", "info");
  };

  // ---------------------------------------------------------------------------
  // 3. ADJUST BOUNDARY: undo, clear
  // ---------------------------------------------------------------------------
  const handleUndo = () => {
    const current = verticesRef.current;
    if (current.length === 0) return;
    const updated = current.slice(0, -1);
    setVertices(updated);
    if (updated.length >= 3) setCurrentStep("adjust");
    else if (updated.length > 0) setCurrentStep("draw");
    else {
      setCurrentStep("find");
      setIsDrawingActive(false);
    }
  };

  const handleClear = () => {
    setVertices([]);
    setAreaAcres(null);
    setValidationError(null);
    setShowClearConfirm(false);
    setCurrentStep("find");
    setIsDrawingActive(false);
    triggerToast("Boundary cleared.", "info");
  };

  // ---------------------------------------------------------------------------
  // 4. CONFIRM & SAVE: emit valid GeoJSON to the wizard
  // ---------------------------------------------------------------------------
  const handleConfirm = async () => {
    if (vertices.length < 3) {
      triggerToast("Please place at least 3 points around the farm boundary.", "warning");
      return;
    }
    const ring = vertices.map((v) => [v.lng, v.lat]);
    ring.push([vertices[0].lng, vertices[0].lat]); // Close the polygon ring
    const geoJSON: GeoJSONPolygon = { type: "Polygon", coordinates: [ring] };

    const calculatedAcres = await computePolygonAreaAcres(geoJSON);
    const validation = await validatePolygon(geoJSON, calculatedAcres);
    if (!validation.valid) {
      triggerToast(validation.reason || "Invalid boundary polygon.", "warning");
      return;
    }
    const centroid = await computeCentroid(geoJSON);
    onConfirm({ geoJSON, areaAcres: calculatedAcres, centroid });
    setShowConfirmModal(false);
    onClose();
  };

  const retryTiles = () => tileHealthRef.current?.retry();
  const imageryProblem = !mapConfig.ok ? "config" : tilesFailing ? "tiles" : null;
  const canRetryLocation = !!gpsError && gpsError.code !== "unsupported" && gpsError.code !== "insecure_context";

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none top-0 left-0 right-0 bottom-0">
      {/* ================= 1. Top Navigation & Search Bar ================= */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 z-30 shadow-lg relative">
        {/* Left: Close & Plot Name */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 flex items-center gap-1.5 text-xs font-bold"
            title={t("p2.ui.return_to_plot_management_1dvad46")}
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">{t("p2.ui.back_52rny")}</span>
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white tracking-tight">{plotName}</span>
              {mapConfig.ok && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  {mapConfig.config.provider}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Search & GPS Locator (Hero Finding Tool) */}
        <div className="flex-1 max-w-xl flex flex-col items-center relative">
          <div className="w-full flex items-center gap-2">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <div className="flex items-center bg-slate-950/90 border border-slate-700 rounded-xl overflow-hidden shadow-inner focus-within:border-emerald-500 transition-colors">
                <div className="pl-3 text-slate-400 shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t("p2.ui.search_village_town_mandal_district_or_addre_2v2xhf")}
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onFocus={() => {
                    if (searchSuggestions.length > 0) setShowSuggestionsDropdown(true);
                  }}
                  className="bg-transparent border-none text-xs text-white px-2.5 py-2 w-full focus:outline-none placeholder:text-slate-500 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchSuggestions([]);
                      setShowSuggestionsDropdown(false);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-300 mr-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 px-3.5 py-1.5 mr-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : t("p2.ui.find_55hsw")}
                </button>
              </div>

              {/* Live Interactive Search Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestionsDropdown && searchSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 text-left"
                  >
                    {searchSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(item.displayName.split(",")[0]);
                          navigateMapToCoordinates(item.lat, item.lng, item.displayName.split(",")[0], 18);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 flex items-start gap-2.5 transition-colors cursor-pointer"
                      >
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {item.displayName.split(",")[0]}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {item.displayName.split(",").slice(1).join(",")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Use My Current Location Button */}
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 disabled:opacity-60 border-0 ${
                gpsAccuracyM !== null
                  ? "bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
              title={gpsAccuracyM !== null ? t("p2.ui.refresh_your_current_location_x3zp9") : t("p2.ui.locate_using_device_browser_current_location_15p9znu")}
            >
              {isLocating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-300" />
              ) : gpsAccuracyM !== null ? (
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden md:inline">
                {isLocating
                  ? t("p2.ui.getting_your_current_location_w57i68")
                  : gpsAccuracyM !== null
                  ? t("p2.ui.refresh_location_j5hd41")
                  : t("p2.ui.use_my_current_location_n67gq8")}
              </span>
            </button>
          </div>

          {/* Quick Region Presets */}
          <div className="hidden md:flex items-center gap-1.5 mt-1.5 overflow-x-auto w-full">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              {t("p2.ui.quick_jump_ktpelu")}
            </span>
            {QUICK_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => navigateMapToCoordinates(loc.lat, loc.lng, loc.name, 17)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-semibold transition-all cursor-pointer shrink-0"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Quick Tools (Basemap, Key config, Help) */}
        <div className="flex items-center gap-1.5">
          {/* Top Draw CTA if in Find Step */}
          {!isDrawingActive && vertices.length < 3 && (
            <button
              type="button"
              onClick={handleStartDrawing}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all shadow-md cursor-pointer border-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t("p2.ui.draw_boundary_1xy3wtb")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHelpGuide(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
            title={t("p2.ui.step_by_step_survey_guide_kehy9a")}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================= 2. Map Canvas (Full Viewport Hero) ================= */}
      <main
        // `isolate` makes the map its own stacking context: Leaflet's internal panes use
        // z-index 400-700 and would otherwise paint above the confirm/clear dialogs.
        className={`relative isolate z-0 flex-1 w-full h-full bg-slate-950 overflow-hidden ${
          isDrawingActive ? "cursor-crosshair" : "cursor-grab"
        }`}
        onClick={() => setShowSuggestionsDropdown(false)}
      >
        <div ref={mapContainerRef} className="survey-map w-full h-full" />

        {/* Loading Indicator for Maps */}
        {isLoadingMaps && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-40">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-bold text-slate-200">{t("p2.ui.loading_high_resolution_satellite_map_223dij")}</p>
          </div>
        )}

        {imageryProblem === "config" && !mapConfig.ok && <MapImageryNotice kind="config" message={mapConfig.message} />}
        {imageryProblem === "tiles" && mapConfig.ok && (
          <MapImageryNotice kind="tiles" provider={mapConfig.config.provider} onRetry={retryTiles} />
        )}

        {/* Top Floating Status Pills */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-md">
          {/* GPS Loading State */}
          {isLocating && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/95 backdrop-blur-md border border-blue-500/50 p-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs text-blue-300"
            >
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              <span className="font-semibold">
                {t("p2.ui.getting_your_current_location_w57i68")}
                {interimAccuracyM !== null ? ` (±${Math.round(interimAccuracyM)} m)` : ""}
              </span>
            </motion.div>
          )}

          {/* Location Found Confirmation (Search) with immediate Draw Action */}
          {locationFoundNotice && !isLocating && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-300 text-xs">{locationFoundNotice}</span>
                  <p className="text-[10px] text-slate-300">{t("p2.ui.move_map_to_your_farm_parcel_and_start_drawi_d4yzbq")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isDrawingActive && (
                  <button
                    type="button"
                    onClick={handleStartDrawing}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer border-0 shadow-md flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t("p2.ui.draw_boundary_1xy3wtb")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLocationFoundNotice(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* GPS Low Accuracy Warning */}
          {gpsWarning && gpsAccuracyM !== null && !isLocating && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-950/95 backdrop-blur-md border border-amber-500/60 p-3 rounded-2xl shadow-2xl space-y-2 text-left max-w-sm"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-200">
                    {t("p2.survey.accuracy_low", { m: Math.round(gpsAccuracyM) })}
                  </p>
                  <p className="text-[10px] text-amber-300/80 leading-snug mt-0.5">
                    {gpsWarning}
                  </p>
                  <p className="text-[10px] text-amber-200/80 leading-snug mt-1">{t("p5.survey.gps_note")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg cursor-pointer flex items-center gap-1 border-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t("p2.ui.try_again_1m8x8b8")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (searchInputRef.current) searchInputRef.current.focus();
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] rounded-lg cursor-pointer flex items-center gap-1 border border-slate-700"
                >
                  <Search className="w-3 h-3" />
                  <span>{t("p2.ui.search_village_dj3j0b")}</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* GPS High Accuracy Status Pill */}
          {!gpsWarning && gpsAccuracyM !== null && !isLocating && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/95 backdrop-blur-md border border-blue-500/40 p-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-2">
                <Crosshair className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-blue-300">
                    {t("p2.survey.accuracy", { m: Math.round(gpsAccuracyM) })}
                  </p>
                  <p className="text-[9px] text-slate-400 leading-snug mt-0.5">
                    {formattedLocationTime ? `${t("p2.survey.acquired_at", { time: formattedLocationTime })} • ` : ""}{t("p2.survey.centered")}
                  </p>
                  <p className="text-[10px] text-slate-300 leading-snug mt-1">{t("p5.survey.accuracy_radius", { m: Math.round(gpsAccuracyM) })}</p>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{t("p5.survey.gps_note")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer border border-slate-700 flex items-center gap-1 text-[10px] font-medium"
                  title={t("p2.ui.refresh_location_j5hd41")}
                >
                  <RefreshCw className="w-3 h-3 text-blue-400" />
                  <span className="hidden sm:inline">{t("p2.ui.refresh_y5das4")}</span>
                </button>
                {!isDrawingActive && (
                  <button
                    type="button"
                    onClick={handleStartDrawing}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] rounded-lg cursor-pointer border-0"
                  >
                    {t("p2.ui.draw_boundary_1xy3wtb")}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* GPS Error Alert */}
          {gpsError && !isLocating && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-950/95 border border-rose-800/80 p-3 rounded-2xl text-xs text-rose-200 flex items-center justify-between gap-2 shadow-xl text-left max-w-sm"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[11px] leading-snug block">{gpsError.message}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canRetryLocation && (
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="min-h-9 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] rounded-lg cursor-pointer border-0"
                  >
                    {t("p2.ui.try_again_1m8x8b8")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setGpsError(null)}
                  className="text-rose-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Geometry Validation Warning */}
          {validationError && (
            <div className="bg-rose-950/90 border border-rose-800/80 px-3 py-2 rounded-xl text-xs text-rose-200 flex items-center gap-2 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold text-[11px]">{validationError}</span>
            </div>
          )}
        </div>

        {/* Floating Right Controls: Zoom & Basemap */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-xl flex flex-col">
            <button
              type="button"
              onClick={() => {
                mapRef.current?.zoomIn();
              }}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer border-b border-slate-800"
              title={t("p2.ui.zoom_in_edl7kb")}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                mapRef.current?.zoomOut();
              }}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title={t("p2.ui.zoom_out_jilbc8")}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= 3. STEP 1 INITIAL OVERLAY CARD (For New Plots) ================= */}
        {currentStep === "find" && vertices.length === 0 && !locationFoundNotice && !gpsAccuracyM && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-6 rounded-3xl shadow-2xl max-w-sm w-11/12 text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <MapPin className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-base text-white">{t("p2.ui.find_your_farm_155e91f")}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {renderRich(t("p2.survey.find_hint"), { a: <strong>{t("p2.survey.use_loc")}</strong>, b: <strong>{t("p2.survey.draw_farm")}</strong> })}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border-0 disabled:opacity-60"
              >
                {isLocating ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Navigation className="w-4 h-4 text-white" />
                )}
                <span>{isLocating ? t("p2.ui.getting_your_current_location_w57i68") : t("p2.ui.use_my_current_location_coch5p")}</span>
              </button>

              <button
                type="button"
                onClick={handleStartDrawing}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <Edit3 className="w-4 h-4" />
                <span>{t("p2.ui.draw_farm_boundary_1cok33l")}</span>
              </button>
              <p className="text-[10px] text-slate-400 mt-1">
                {t("p2.ui.or_search_above_or_pan_map_freely_ndv8ig")}
              </p>
            </div>
          </motion.div>
        )}

        {/* ================= 4. COMPACT FLOATING MEASUREMENT CARD ================= */}
        {vertices.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-36 sm:bottom-32 left-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-2xl shadow-2xl max-w-[240px] w-full text-left font-sans"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-extrabold text-[11px] text-white uppercase tracking-wider">
                  {t("p2.ui.farm_boundary_1cgfk8d")}
                </span>
              </div>
              <div className="inline-flex bg-slate-800 p-0.5 rounded-md border border-slate-700">
                {(["acres", "hectares"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setAreaUnit(u)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${
                      areaUnit === u ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {u === "acres" ? "ac" : "ha"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">{t("p2.ui.area_4d4x3a")}</span>
                <span className="font-mono font-black text-emerald-400 text-xs">
                  {areaAcres !== null
                    ? areaUnit === "hectares"
                      ? `${acresToHectares(areaAcres).toFixed(2)} ha`
                      : `${areaAcres.toFixed(2)} acres`
                    : t("p2.ui.connecting_h7kdf3")}
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">{t("p2.ui.perimeter_17h1738")}</span>
                <span className="font-mono font-bold text-white text-xs">
                  {segmentStats.perimeterM > 1000
                    ? `${(segmentStats.perimeterM / 1000).toFixed(2)} km`
                    : `${Math.round(segmentStats.perimeterM)} m`}
                </span>
              </div>

              {vertices.length >= 3 && !isDrawingActive && (
                <p className="text-[10px] leading-snug text-slate-400">{t("p5.survey.vertex_hint")}</p>
              )}

              <div className="flex justify-between items-baseline pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400">{t("p2.ui.points_9km374")}</span>
                <span className="font-mono font-semibold text-slate-300 text-[11px]">
                  {vertices.length} {t("p2.ui.vertices_162d14w")}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= 5. FLOATING BOTTOM GUIDED HUD & ACTION BAR ================= */}
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-2xl flex flex-col items-center gap-2">
          {/* Active Drawing Banner */}
          {isDrawingActive ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950/90 border border-emerald-500/50 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs text-emerald-200"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-bold text-[11px] sm:text-xs">
                {t("p2.survey.drawing_active", { n: vertices.length })}
              </span>
            </motion.div>
          ) : null}

          {/* Main Action Bar with 4-Step Progress */}
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-2 sm:p-2.5 rounded-2xl shadow-2xl w-full flex flex-wrap items-center justify-between gap-2.5">
            {/* 4-Step Progress Indicator (Clickable to switch modes) */}
            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold overflow-x-auto py-0.5">
              {/* Step 1: Find Farm */}
              <button
                type="button"
                onClick={() => {
                  setCurrentStep("find");
                  setIsDrawingActive(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer border-0 ${
                  currentStep === "find"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : vertices.length > 0
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-300"
                }`}
              >
                <span>①</span>
                <span className="hidden sm:inline">{t("p2.ui.find_farm_giq49i")}</span>
              </button>

              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />

              {/* Step 2: Draw Boundary */}
              <button
                type="button"
                onClick={() => {
                  setCurrentStep("draw");
                  setIsDrawingActive(true);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer border-0 ${
                  currentStep === "draw" || isDrawingActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : vertices.length >= 3
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <span>②</span>
                <span className="hidden sm:inline">{t("p2.ui.draw_boundary_1xy3wtb")}</span>
              </button>

              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />

              {/* Step 3: Adjust */}
              <button
                type="button"
                onClick={() => {
                  if (vertices.length >= 3) {
                    setCurrentStep("adjust");
                    setIsDrawingActive(false);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer border-0 ${
                  currentStep === "adjust" && !isDrawingActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : vertices.length >= 3
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-500 opacity-60 cursor-not-allowed"
                }`}
              >
                <span>③</span>
                <span className="hidden sm:inline">{t("p2.ui.adjust_1s2iyra")}</span>
              </button>

              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />

              {/* Step 4: Confirm */}
              <button
                type="button"
                onClick={() => {
                  if (vertices.length >= 3 && !validationError) {
                    setShowConfirmModal(true);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer border-0 ${
                  currentStep === "confirm"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : vertices.length >= 3
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-500 opacity-60 cursor-not-allowed"
                }`}
              >
                <span>④</span>
                <span className="hidden sm:inline">{t("p2.ui.confirm_vxe75l")}</span>
              </button>
            </div>

            {/* Action Buttons Group */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Draw Boundary Trigger (When not in drawing mode and few vertices) */}
              {!isDrawingActive && vertices.length < 3 && (
                <button
                  type="button"
                  onClick={handleStartDrawing}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t("p2.ui.draw_farm_boundary_1gc13dr")}</span>
                </button>
              )}

              {/* Editing Controls: Undo, Clear, Toggle Edit (When points exist) */}
              {vertices.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 flex items-center gap-1 text-xs font-semibold"
                    title={t("p2.ui.undo_last_point_k26lob")}
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden md:inline">{t("p2.ui.undo_5f62z")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 transition-all cursor-pointer border border-slate-700 flex items-center gap-1 text-xs font-semibold"
                    title={t("p2.ui.clear_boundary_xd1qbo")}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden md:inline">{t("p2.ui.clear_4e4oee")}</span>
                  </button>

                  {/* Toggle Edit/Add points */}
                  <button
                    type="button"
                    onClick={() => setIsDrawingActive(!isDrawingActive)}
                    className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                      isDrawingActive
                        ? "bg-emerald-500 text-slate-950 border-emerald-400 font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                    title={isDrawingActive ? t("p2.ui.done_adding_points_396kjv") : t("p2.ui.add_more_points_3qf6dk")}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{isDrawingActive ? t("p2.ui.done_adding_vdic9k") : t("p2.ui.edit_add_18vbl5t")}</span>
                  </button>
                </>
              )}

              {/* Confirm & Save Button */}
              <button
                type="button"
                onClick={() => {
                  if (vertices.length >= 3 && !validationError) {
                    setShowConfirmModal(true);
                  }
                }}
                disabled={vertices.length < 3 || !!validationError}
                className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border-0 ${
                  vertices.length >= 3 && !validationError
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{t("p2.ui.confirm_save_1uyhwv2")}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ================= 6. Clear Boundary Confirmation Dialog ================= */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-base text-white">{t("p2.ui.clear_farm_boundary_fp17t1")}</h3>
                <p className="text-xs text-slate-300">
                  {t("p2.survey.clear_body", { n: vertices.length })}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  {t("p2.ui.cancel_1sz100x")}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white cursor-pointer border-0"
                >
                  {t("p2.ui.yes_clear_y4mcbd")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 7. Confirm & Save Summary Modal ================= */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">{t("p2.ui.confirm_farm_boundary_193mzsd")}</h3>
                    <p className="text-xs text-slate-400">{t("p2.ui.review_surveyed_measurements_h9nzh9")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary Stats Box */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{t("p2.ui.farm_name_4c9rzg")}</span>
                  <span className="font-bold text-white">{plotName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{t("p2.ui.total_area_5fpoei")}</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {areaAcres !== null ? `${areaAcres.toFixed(2)} acres (${acresToHectares(areaAcres).toFixed(2)} ha)` : "--"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{t("p2.ui.perimeter_17h1738")}</span>
                  <span className="font-mono font-bold text-white">
                    {segmentStats.perimeterM > 1000
                      ? `${(segmentStats.perimeterM / 1000).toFixed(2)} km`
                      : `${Math.round(segmentStats.perimeterM)} m`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{t("p2.ui.boundary_points_16mo3wo")}</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {vertices.length} {t("p2.ui.vertices_162d14w")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  {t("p2.ui.back_to_map_n2aq5l")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer border-0 shadow-lg shadow-emerald-500/20"
                >
                  {t("p2.ui.confirm_save_boundary_ycx4xr")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 9. Instructions Guide Modal ================= */}
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
                  <h3 className="font-black text-base text-white">{t("p2.ui.farmer_boundary_survey_guide_1bsrwja")}</h3>
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
                  <p className="font-bold text-white">{t("p2.ui.1_find_farm_1nhhsw1")}</p>
                  <p>{renderRich(t("p2.survey.step1"), { a: <strong>{t("p2.survey.use_loc")}</strong> })}</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">{t("p2.ui.2_draw_farm_boundary_15azefp")}</p>
                  <p>{renderRich(t("p2.survey.step2"), { a: <strong>{t("p2.survey.draw_farm")}</strong> })}</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">{t("p2.ui.3_adjust_boundary_uetl3x")}</p>
                  <p>{renderRich(t("p2.survey.step3"), { a: <strong>{t("p2.survey.undo")}</strong>, b: <strong>{t("p2.survey.edit_add")}</strong> })}</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">{t("p2.ui.4_confirm_save_oi1hy")}</p>
                  <p>{renderRich(t("p2.survey.step4"), { a: <strong>{t("p2.survey.confirm_save")}</strong> })}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHelpGuide(false)}
                className="w-full py-2.5 bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer hover:bg-emerald-400 transition-all border-0"
              >
                {t("p2.ui.got_it_1v2z292")}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default BoundarySurveyor;
