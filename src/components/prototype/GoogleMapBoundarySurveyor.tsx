/**
 * GoogleMapBoundarySurveyor.tsx
 *
 * Full-Screen Google Maps Farm Boundary Surveyor
 * Redesigned for a precise, intuitive 4-step farmer workflow:
 * 1. FIND FARM       (Search village/town/area with live suggestions OR Use Current GPS)
 * 2. DRAW BOUNDARY   (Prominent CTA, tap farm corners on satellite imagery)
 * 3. ADJUST BOUNDARY (Drag vertices, Undo, Clear with confirm, live edge lengths)
 * 4. CONFIRM & SAVE  (Area + Perimeter summary, validation, emit standard GeoJSON)
 *
 * Primary Provider: Official Google Maps JavaScript API (Satellite / Hybrid).
 * Fallback Provider: High-Resolution Satellite Engine (Esri World Imagery).
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Google Maps Instance & Overlays
  const googleMapRef = useRef<any>(null);
  const googlePolygonRef = useRef<any>(null);
  const googlePolylineRef = useRef<any>(null);
  const googleAccuracyCircleRef = useRef<any>(null);
  const googleUserMarkerRef = useRef<any>(null);
  const googleSearchMarkerRef = useRef<any>(null);
  const googlePlacesAutocompleteRef = useRef<any>(null);

  // Leaflet Fallback Refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletPolygonRef = useRef<L.Polygon | null>(null);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletAccuracyCircleRef = useRef<L.Circle | null>(null);
  const leafletUserMarkerRef = useRef<L.CircleMarker | L.Marker | null>(null);
  const leafletSearchMarkerRef = useRef<L.Marker | null>(null);

  // Geolocation Multi-Reading Watch Refs
  const watchIdRef = useRef<number | null>(null);
  const watchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestPositionRef = useRef<GeolocationPosition | null>(null);
  const readingsCountRef = useRef<number>(0);

  // State Machine: Step 1 (find), Step 2 (draw), Step 3 (adjust), Step 4 (confirm)
  const [currentStep, setCurrentStep] = useState<SurveyStep>("find");
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  // General States
  const [activeEngine, setActiveEngine] = useState<"google" | "satellite_fallback">("google");
  const [areaUnit, setAreaUnit] = useState<"acres" | "hectares">(defaultAreaUnit);
  const [mapType, setMapType] = useState<"hybrid" | "roadmap" | "satellite">("hybrid");
  const [vertices, setVertices] = useState<Array<{ lat: number; lng: number }>>([]);
  const [areaAcres, setAreaAcres] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // GPS Geolocation States (Honest, Real Geolocation API with accuracy tracking, zero caching)
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  // Location Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [locationFoundNotice, setLocationFoundNotice] = useState<string | null>(null);

  // Modals & UI States
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(true);
  const [mapsLoadError, setMapsLoadError] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const triggerToast = useCallback(
    (msg: string, type: "success" | "info" | "warning" = "info") => {
      if (showToast) showToast(msg, type);
    },
    [showToast]
  );

  // Keep drawing active state synchronized with ref for event handlers
  const isDrawingActiveRef = useRef(isDrawingActive);
  useEffect(() => {
    isDrawingActiveRef.current = isDrawingActive;
  }, [isDrawingActive]);

  const verticesRef = useRef(vertices);
  useEffect(() => {
    verticesRef.current = vertices;
  }, [vertices]);

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
  // Geometry & Distance calculations
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
  const renderLeafletPolygon = useCallback(
    (pts: Array<{ lat: number; lng: number }>) => {
      if (!leafletMapRef.current || !leafletMarkersGroupRef.current || !leafletPolygonRef.current) return;
      leafletMarkersGroupRef.current.clearLayers();
      const latLngs = pts.map((p) => [p.lat, p.lng] as [number, number]);

      if (pts.length >= 3) {
        leafletPolygonRef.current.setLatLngs(latLngs);
        if (leafletPolylineRef.current) leafletPolylineRef.current.setLatLngs([]);
      } else {
        leafletPolygonRef.current.setLatLngs([]);
        if (leafletPolylineRef.current) leafletPolylineRef.current.setLatLngs(latLngs);
      }

      // Add draggable vertex markers
      pts.forEach((pt, idx) => {
        const marker = L.circleMarker([pt.lat, pt.lng], {
          radius: 8,
          color: "#ffffff",
          fillColor: "#10b981",
          fillOpacity: 1,
          weight: 2.5,
        });

        marker.on("mousedown", () => {
          if (!leafletMapRef.current) return;
          leafletMapRef.current.dragging.disable();
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            const newPts = [...verticesRef.current];
            newPts[idx] = { lat: e.latlng.lat, lng: e.latlng.lng };
            setVertices(newPts);
            renderLeafletPolygon(newPts);
            recalculateGeometry(newPts);
          };
          const onMouseUp = () => {
            if (leafletMapRef.current) {
              leafletMapRef.current.dragging.enable();
              leafletMapRef.current.off("mousemove", onMouseMove);
              leafletMapRef.current.off("mouseup", onMouseUp);
            }
          };
          leafletMapRef.current.on("mousemove", onMouseMove);
          leafletMapRef.current.on("mouseup", onMouseUp);
        });

        marker.addTo(leafletMarkersGroupRef.current!);
      });
    },
    [recalculateGeometry]
  );

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
        fillOpacity: 0.3,
        weight: 3,
      }).addTo(map);
      leafletPolygonRef.current = polygon;

      const polyline = L.polyline([], {
        color: "#34d399",
        weight: 2.5,
        dashArray: "4, 6",
      }).addTo(map);
      leafletPolylineRef.current = polyline;

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (!isDrawingActiveRef.current) return;
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        setVertices((prev) => {
          const updated = [...prev, { lat, lng }];
          renderLeafletPolygon(updated);
          recalculateGeometry(updated);
          if (updated.length >= 3) {
            setCurrentStep("adjust");
          } else {
            setCurrentStep("draw");
          }
          return updated;
        });
      });

      if (coords.length >= 3) {
        renderLeafletPolygon(coords);
        const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 19 });
        setCurrentStep("adjust");
        setIsDrawingActive(false);
      } else {
        setCurrentStep("find");
        setIsDrawingActive(false);
      }

      leafletMapRef.current = map;
      setActiveEngine("satellite_fallback");
      setIsLoadingMaps(false);
    },
    [renderLeafletPolygon, recalculateGeometry]
  );

  // ---------------------------------------------------------------------------
  // Move Map to Location Helper (Works on both Google Maps and Leaflet)
  // ---------------------------------------------------------------------------
  const navigateMapToCoordinates = useCallback(
    (lat: number, lng: number, placeName: string, zoomLevel = 18) => {
      setLocationFoundNotice(`📍 Located: ${placeName}`);
      setShowSuggestionsDropdown(false);

      if (activeEngine === "google" && googleMapRef.current && window.google?.maps) {
        const latLng = new window.google.maps.LatLng(lat, lng);
        googleMapRef.current.panTo(latLng);
        googleMapRef.current.setZoom(zoomLevel);

        if (googleSearchMarkerRef.current) {
          googleSearchMarkerRef.current.setMap(null);
        }
        googleSearchMarkerRef.current = new window.google.maps.Marker({
          position: latLng,
          map: googleMapRef.current,
          title: placeName,
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: 8,
        });
      } else if (leafletMapRef.current) {
        leafletMapRef.current.setView([lat, lng], zoomLevel);
        if (leafletSearchMarkerRef.current) {
          leafletMapRef.current.removeLayer(leafletSearchMarkerRef.current);
        }
        leafletSearchMarkerRef.current = L.marker([lat, lng]).addTo(leafletMapRef.current);
      }

      triggerToast(`Centered on: ${placeName}. Tap 'Draw Farm Boundary' when ready.`, "success");
    },
    [activeEngine, triggerToast]
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
          minZoom: 3,
        });

        googleMapRef.current = map;

        // Boundary Polygon
        const polygon = new google.maps.Polygon({
          strokeColor: "#10b981",
          strokeOpacity: 0.95,
          strokeWeight: 3,
          fillColor: "#10b981",
          fillOpacity: 0.3,
          editable: true,
          draggable: false,
          zIndex: 10,
        });
        polygon.setMap(map);
        googlePolygonRef.current = polygon;

        // In-progress polyline for 1-2 points
        const polyline = new google.maps.Polyline({
          strokeColor: "#34d399",
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          map: map,
          zIndex: 9,
        });
        googlePolylineRef.current = polyline;

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
            setCurrentStep("adjust");
          }
          recalculateGeometry(newCoords);
        };

        const path = polygon.getPath();
        path.addListener("set_at", updateFromPath);
        path.addListener("insert_at", updateFromPath);
        path.addListener("remove_at", updateFromPath);

        // Map Click Listener
        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          if (!isDrawingActiveRef.current) return;

          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          setVertices((prev) => {
            const updated = [...prev, { lat, lng }];
            const mvcPath = polygon.getPath();
            mvcPath.push(e.latLng);
            if (updated.length < 3) {
              polyline.setPath(mvcPath);
              setCurrentStep("draw");
            } else {
              polyline.setPath([]);
              setCurrentStep("adjust");
            }
            recalculateGeometry(updated);
            return updated;
          });
        });

        // Initialize Places Autocomplete if available with India bias
        if (google.maps.places && searchInputRef.current) {
          try {
            const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
              types: ["geocode", "establishment"],
              fields: ["geometry", "name", "formatted_address"],
              componentRestrictions: { country: ["in"] },
            });
            autocomplete.bindTo("bounds", map);

            autocomplete.addListener("place_changed", () => {
              const place = autocomplete.getPlace();
              if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const name = place.name || place.formatted_address || "Searched Farm Location";
                navigateMapToCoordinates(lat, lng, name, 18);
              }
            });
            googlePlacesAutocompleteRef.current = autocomplete;
          } catch (e) {
            console.warn("Places autocomplete init bypassed:", e);
          }
        }

        // Handle initial GeoJSON geometry if existing plot
        if (initialCoords.length >= 3) {
          const mvcPath = polygon.getPath();
          mvcPath.clear();
          const bounds = new google.maps.LatLngBounds();
          initialCoords.forEach((pt) => {
            const latLng = new google.maps.LatLng(pt.lat, pt.lng);
            mvcPath.push(latLng);
            bounds.extend(latLng);
          });
          map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
          setVertices(initialCoords);
          recalculateGeometry(initialCoords);
          setCurrentStep("adjust");
          setIsDrawingActive(false);
        } else {
          setCurrentStep("find");
          setIsDrawingActive(false);
        }

        setActiveEngine("google");
        setIsLoadingMaps(false);
      } catch (err: any) {
        console.warn("Google Maps JS API did not load:", err?.message);
        setMapsLoadError(err?.message || "Google Maps API key required");
        // Fall back gracefully to the high-resolution satellite engine so farmer is never blocked
        initLeafletFallback(initialCoords);
      }
    },
    [getInitialCoordinates, recalculateGeometry, initLeafletFallback, navigateMapToCoordinates]
  );

  // Helper to stop active GPS watch & clear timeout
  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchTimeoutRef.current !== null) {
      clearTimeout(watchTimeoutRef.current);
      watchTimeoutRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Lifecycle Hook
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      const initialCoords = getInitialCoordinates();
      setVertices(initialCoords);
      if (initialCoords.length >= 3) {
        setCurrentStep("adjust");
        setIsDrawingActive(false);
      } else {
        setCurrentStep("find");
        setIsDrawingActive(false);
      }
      initGoogleMaps();
    }

    return () => {
      stopGpsWatch();
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
      if (googleSearchMarkerRef.current) {
        googleSearchMarkerRef.current.setMap(null);
        googleSearchMarkerRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      googleMapRef.current = null;
    };
  }, [isOpen, initGoogleMaps, getInitialCoordinates, stopGpsWatch]);

  // Keyboard Shortcuts (Escape to close, Ctrl+Z to undo)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showClearConfirm) {
          setShowClearConfirm(false);
        } else if (showConfirmModal) {
          setShowConfirmModal(false);
        } else if (showKeyModal) {
          setShowKeyModal(false);
        } else if (showHelpGuide) {
          setShowHelpGuide(false);
        } else {
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showClearConfirm, showConfirmModal, showKeyModal, showHelpGuide, onClose]);

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

  const formattedLocationTime = useMemo(() => {
    if (!currentLocation?.timestamp) return null;
    return new Date(currentLocation.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [currentLocation]);

  // Helper to apply a location fix to map overlays
  const applyLocationFix = useCallback(
    (pos: GeolocationPosition) => {
      setIsLocating(false);
      const { latitude, longitude, accuracy } = pos.coords;
      const timestamp = pos.timestamp || Date.now();

      setCurrentLocation({ lat: latitude, lng: longitude, accuracy, timestamp });
      setGpsAccuracyM(accuracy);

      // Determine zoom level according to reported accuracy
      let zoom = 19;
      if (accuracy > 500) {
        zoom = 15;
      } else if (accuracy > 150) {
        zoom = 17;
      } else if (accuracy > 30) {
        zoom = 18;
      } else {
        zoom = 19;
      }

      if (activeEngine === "google" && googleMapRef.current && window.google?.maps) {
        const latLng = new window.google.maps.LatLng(latitude, longitude);
        googleMapRef.current.panTo(latLng);
        googleMapRef.current.setZoom(zoom);

        // Clear previous accuracy circle & marker
        if (googleAccuracyCircleRef.current) {
          googleAccuracyCircleRef.current.setMap(null);
        }
        googleAccuracyCircleRef.current = new window.google.maps.Circle({
          strokeColor: accuracy > 100 ? "#f59e0b" : "#3b82f6",
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: accuracy > 100 ? "#f59e0b" : "#3b82f6",
          fillOpacity: 0.15,
          map: googleMapRef.current,
          center: latLng,
          radius: accuracy,
          zIndex: 4,
        });

        if (googleUserMarkerRef.current) {
          googleUserMarkerRef.current.setMap(null);
        }

        // Exact location Blue Dot marker
        googleUserMarkerRef.current = new window.google.maps.Marker({
          position: latLng,
          map: googleMapRef.current,
          title: `Your Location (±${Math.round(accuracy)}m)`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: accuracy > 100 ? "#f59e0b" : "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2.5,
          },
          zIndex: 6,
        });
      } else if (leafletMapRef.current) {
        leafletMapRef.current.setView([latitude, longitude], zoom);
        if (leafletAccuracyCircleRef.current) {
          leafletMapRef.current.removeLayer(leafletAccuracyCircleRef.current);
        }
        leafletAccuracyCircleRef.current = L.circle([latitude, longitude], {
          radius: accuracy,
          color: accuracy > 100 ? "#f59e0b" : "#3b82f6",
          fillColor: accuracy > 100 ? "#f59e0b" : "#3b82f6",
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(leafletMapRef.current);

        if (leafletUserMarkerRef.current) {
          leafletMapRef.current.removeLayer(leafletUserMarkerRef.current);
        }
        leafletUserMarkerRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#ffffff",
          fillColor: accuracy > 100 ? "#f59e0b" : "#2563eb",
          fillOpacity: 1,
          weight: 2.5,
        }).addTo(leafletMapRef.current);
      }

      // Accuracy evaluation
      if (accuracy > 100) {
        setGpsWarning(
          "Your location accuracy is low. Move outdoors or enable device location services and try again."
        );
        triggerToast(
          `Low accuracy (±${Math.round(accuracy)} m). Move outdoors or search your village name above.`,
          "warning"
        );
      } else {
        setGpsWarning(null);
        triggerToast(
          `Location acquired (±${Math.round(accuracy)} m). Move to your farm and tap Draw Boundary.`,
          "success"
        );
      }
    },
    [activeEngine, triggerToast]
  );

  // ---------------------------------------------------------------------------
  // 1. FIND FARM: Geolocation Handler (Multi-Reading Watch Flow, Zero Stale Caching)
  // ---------------------------------------------------------------------------
  const handleUseCurrentLocation = useCallback(() => {
    // 1. Cancel any active watch or timeout before starting a fresh acquisition
    stopGpsWatch();

    if (!navigator.geolocation) {
      const err = "Geolocation is not supported by your browser or device.";
      setGpsError(err);
      triggerToast(err, "warning");
      return;
    }

    // 2. Clear previous location overlays immediately so no stale visual state remains
    if (googleAccuracyCircleRef.current) {
      googleAccuracyCircleRef.current.setMap(null);
      googleAccuracyCircleRef.current = null;
    }
    if (googleUserMarkerRef.current) {
      googleUserMarkerRef.current.setMap(null);
      googleUserMarkerRef.current = null;
    }
    if (leafletAccuracyCircleRef.current && leafletMapRef.current) {
      leafletMapRef.current.removeLayer(leafletAccuracyCircleRef.current);
      leafletAccuracyCircleRef.current = null;
    }
    if (leafletUserMarkerRef.current && leafletMapRef.current) {
      leafletMapRef.current.removeLayer(leafletUserMarkerRef.current);
      leafletUserMarkerRef.current = null;
    }

    // 3. Reset state for completely fresh multi-reading acquisition
    setIsLocating(true);
    setGpsError(null);
    setGpsWarning(null);
    bestPositionRef.current = null;
    readingsCountRef.current = 0;

    const finishAcquisition = () => {
      stopGpsWatch();
      if (bestPositionRef.current) {
        applyLocationFix(bestPositionRef.current);
      } else {
        setIsLocating(false);
        setGpsError("Your device could not determine an accurate location. Try again outdoors.");
      }
    };

    // 4. Acquisition window timeout (~10 seconds): finalize with the best reading collected
    watchTimeoutRef.current = setTimeout(() => {
      if (import.meta.env?.DEV) {
        console.debug(
          "[Geolocation] 10-second acquisition window expired. Selecting best reading collected:",
          bestPositionRef.current
            ? {
                latitude: bestPositionRef.current.coords.latitude,
                longitude: bestPositionRef.current.coords.longitude,
                accuracy: bestPositionRef.current.coords.accuracy,
                timestamp: bestPositionRef.current.timestamp,
              }
            : "No reading received"
        );
      }
      finishAcquisition();
    }, 10000);

    // 5. Start watchPosition to collect multiple fresh readings and pick the best accuracy
    try {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          readingsCountRef.current += 1;
          const { latitude, longitude, accuracy } = pos.coords;
          const timestamp = pos.timestamp || Date.now();

          // Development-only console.debug output for each reading
          if (import.meta.env?.DEV) {
            console.debug(
              `[Geolocation reading #${readingsCountRef.current}]`,
              `latitude: ${latitude}, longitude: ${longitude}, accuracy: ±${Math.round(accuracy)}m, timestamp: ${new Date(timestamp).toISOString()}`
            );
          }

          // Select the reading with the best/smallest coords.accuracy
          if (!bestPositionRef.current || accuracy < bestPositionRef.current.coords.accuracy) {
            bestPositionRef.current = pos;
          }

          // Stop watch once accuracy <= 30m (high-accuracy GPS fix achieved)
          if (accuracy <= 30) {
            if (import.meta.env?.DEV) {
              console.debug(
                `[Geolocation] High-accuracy fix reached (±${Math.round(accuracy)}m <= 30m) on reading #${readingsCountRef.current}. Finalizing acquisition.`
              );
            }
            finishAcquisition();
          }
        },
        (err) => {
          // If we already collected at least one reading, don't fail immediately; let timeout apply the best reading
          if (bestPositionRef.current) {
            return;
          }

          stopGpsWatch();
          setIsLocating(false);
          setGpsAccuracyM(null);
          let msg = "Could not obtain your current location. Please try again.";
          if (err.code === err.PERMISSION_DENIED) {
            msg = "Location permission was denied. Allow location access in your browser and try again.";
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = "Your device could not determine an accurate location. Try again outdoors.";
          } else if (err.code === err.TIMEOUT) {
            msg = "Location request timed out. Try again.";
          }
          setGpsError(msg);
          triggerToast(msg, "warning");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
      watchIdRef.current = watchId;
    } catch {
      stopGpsWatch();
      setIsLocating(false);
      setGpsError("Could not start geolocation watch.");
    }
  }, [stopGpsWatch, applyLocationFix, triggerToast]);

  // ---------------------------------------------------------------------------
  // 1. FIND FARM: Live Search Input Changes & Geocoding Resolver
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
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          val.trim()
        )}&countrycodes=in&addressdetails=1&limit=5`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const formatted: SearchSuggestion[] = data.map((d: any) => ({
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setGpsError(null);
    setShowSuggestionsDropdown(false);

    // Try Google Maps Geocoder if Google is active
    if (activeEngine === "google" && window.google?.maps?.Geocoder) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { address: searchQuery.trim(), componentRestrictions: { country: "IN" } },
          (results: any, status: any) => {
            setIsSearching(false);
            if (status === "OK" && results && results[0]) {
              const loc = results[0].geometry.location;
              navigateMapToCoordinates(loc.lat(), loc.lng(), results[0].formatted_address.split(",")[0], 18);
            } else {
              // Try unconstrained Google Geocoder or fallback to Nominatim
              geocoder.geocode({ address: searchQuery.trim() }, (r2: any, s2: any) => {
                if (s2 === "OK" && r2 && r2[0]) {
                  const loc2 = r2[0].geometry.location;
                  navigateMapToCoordinates(loc2.lat(), loc2.lng(), r2[0].formatted_address.split(",")[0], 18);
                } else {
                  fallbackOsmSearch(searchQuery.trim());
                }
              });
            }
          }
        );
        return;
      } catch {
        // Fall back to OSM Nominatim
      }
    }

    fallbackOsmSearch(searchQuery.trim());
  };

  const fallbackOsmSearch = async (query: string) => {
    try {
      // Try with countrycodes=in first
      let res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=in&addressdetails=1&limit=5`
      );
      let data = await res.json();

      // If nothing found, try global search
      if (!data || data.length === 0) {
        res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=5`
        );
        data = await res.json();
      }

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const name = data[0].display_name.split(",")[0];
        navigateMapToCoordinates(lat, lon, name, 18);
      } else {
        triggerToast("Location not found. Try entering a nearby town or mandal name.", "warning");
      }
    } catch {
      triggerToast("Search connection failed. Please check internet connection.", "warning");
    } finally {
      setIsSearching(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. START DRAWING: Transition to Drawing Mode
  // ---------------------------------------------------------------------------
  const handleStartDrawing = () => {
    setIsDrawingActive(true);
    setCurrentStep(vertices.length >= 3 ? "adjust" : "draw");
    triggerToast("Drawing Mode Active! Click on the satellite map to add boundary points.", "info");
  };

  // ---------------------------------------------------------------------------
  // 3. ADJUST BOUNDARY: Undo, Clear & Edit
  // ---------------------------------------------------------------------------
  const handleUndo = () => {
    if (vertices.length === 0) return;
    const updated = vertices.slice(0, -1);
    setVertices(updated);

    if (activeEngine === "google" && googlePolygonRef.current) {
      const mvcPath = googlePolygonRef.current.getPath();
      mvcPath.pop();
      if (googlePolylineRef.current) {
        if (updated.length < 3) {
          googlePolylineRef.current.setPath(mvcPath);
        } else {
          googlePolylineRef.current.setPath([]);
        }
      }
    } else if (leafletMapRef.current) {
      renderLeafletPolygon(updated);
    }

    if (updated.length >= 3) {
      setCurrentStep("adjust");
    } else if (updated.length > 0) {
      setCurrentStep("draw");
    } else {
      setCurrentStep("find");
      setIsDrawingActive(false);
    }

    recalculateGeometry(updated);
  };

  const handleClear = () => {
    setVertices([]);
    setAreaAcres(null);
    setValidationError(null);
    setShowClearConfirm(false);

    if (activeEngine === "google" && googlePolygonRef.current) {
      googlePolygonRef.current.getPath().clear();
      if (googlePolylineRef.current) googlePolylineRef.current.setPath([]);
    } else if (leafletMapRef.current && leafletPolygonRef.current) {
      leafletPolygonRef.current.setLatLngs([]);
      if (leafletPolylineRef.current) leafletPolylineRef.current.setLatLngs([]);
      leafletMarkersGroupRef.current?.clearLayers();
    }

    setCurrentStep("find");
    setIsDrawingActive(false);
    triggerToast("Boundary cleared.", "info");
  };

  // ---------------------------------------------------------------------------
  // 4. CONFIRM & SAVE: Emit Valid GeoJSON to Wizard
  // ---------------------------------------------------------------------------
  const handleConfirm = async () => {
    if (vertices.length < 3) {
      triggerToast("Please place at least 3 points around the farm boundary.", "warning");
      return;
    }

    const ring = vertices.map((v) => [v.lng, v.lat]);
    ring.push([vertices[0].lng, vertices[0].lat]); // Close the polygon ring

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
    setShowConfirmModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none top-0 left-0 right-0 bottom-0">
      {/* Dynamic Styling for Google Places Autocomplete dropdown */}
      <style>{`
        .pac-container {
          z-index: 100001 !important;
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
          border-radius: 14px !important;
          margin-top: 6px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6) !important;
          font-family: inherit !important;
          overflow: hidden !important;
        }
        .pac-item {
          color: #e2e8f0 !important;
          border-top: 1px solid #1e293b !important;
          padding: 10px 14px !important;
          cursor: pointer !important;
          font-size: 13px !important;
        }
        .pac-item:hover, .pac-item-selected {
          background-color: #1e293b !important;
        }
        .pac-item-query {
          color: #38bdf8 !important;
          font-weight: 700 !important;
          font-size: 13px !important;
        }
        .pac-matched {
          font-weight: 800 !important;
          color: #10b981 !important;
        }
        .pac-icon {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      `}</style>

      {/* ================= 1. Top Navigation & Search Bar ================= */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 z-30 shadow-lg relative">
        {/* Left: Close & Plot Name */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 flex items-center gap-1.5 text-xs font-bold"
            title="Return to plot management"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white tracking-tight">{plotName}</span>
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
                  placeholder="Search village, town, mandal, district or address..."
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
                  {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Find"}
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
              title={gpsAccuracyM !== null ? "Refresh your current location" : "Locate using device/browser current location"}
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
                  ? "Getting your current location…"
                  : gpsAccuracyM !== null
                  ? "Refresh Location"
                  : "Use My Current Location"}
              </span>
            </button>
          </div>

          {/* Quick Region Presets */}
          <div className="hidden md:flex items-center gap-1.5 mt-1.5 overflow-x-auto w-full">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Quick Jump:
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
              <span>Draw Boundary</span>
            </button>
          )}

          <div className="hidden sm:inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            {(["hybrid", "roadmap"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleBasemapChange(t)}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  mapType === t ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {t === "hybrid" ? "Satellite" : "Roads"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all cursor-pointer border border-slate-700"
            title="Google Maps API Key Configuration"
          >
            <Key className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowHelpGuide(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
            title="Step-by-step Survey Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================= 2. Map Canvas (Full Viewport Hero) ================= */}
      <main
        className={`relative flex-1 w-full h-full bg-slate-950 overflow-hidden ${
          isDrawingActive ? "cursor-crosshair" : "cursor-grab"
        }`}
        onClick={() => setShowSuggestionsDropdown(false)}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading Indicator for Maps */}
        {isLoadingMaps && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-40">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-bold text-slate-200">Loading High-Resolution Satellite Map...</p>
          </div>
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
              <span className="font-semibold">Getting your current location…</span>
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
                  <p className="text-[10px] text-slate-300">Move map to your farm parcel and start drawing</p>
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
                    <span>Draw Boundary</span>
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
                    Location accuracy: ±{Math.round(gpsAccuracyM)} m (Low Accuracy)
                  </p>
                  <p className="text-[10px] text-amber-300/80 leading-snug mt-0.5">
                    {gpsWarning}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg cursor-pointer flex items-center gap-1 border-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (searchInputRef.current) searchInputRef.current.focus();
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] rounded-lg cursor-pointer flex items-center gap-1 border border-slate-700"
                >
                  <Search className="w-3 h-3" />
                  <span>Search Village</span>
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
                    Location accuracy: ±{Math.round(gpsAccuracyM)} m
                  </p>
                  <p className="text-[9px] text-slate-400 leading-snug mt-0.5">
                    {formattedLocationTime ? `Acquired at ${formattedLocationTime} • ` : ""}Map centered on your current position.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer border border-slate-700 flex items-center gap-1 text-[10px] font-medium"
                  title="Refresh Location"
                >
                  <RefreshCw className="w-3 h-3 text-blue-400" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                {!isDrawingActive && (
                  <button
                    type="button"
                    onClick={handleStartDrawing}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] rounded-lg cursor-pointer border-0"
                  >
                    Draw Boundary
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
                  <span className="font-semibold text-[11px] leading-snug block">{gpsError}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg cursor-pointer border-0"
                >
                  Try Again
                </button>
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
              <h3 className="font-black text-base text-white">Find Your Farm</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Search your village name above or click <strong>Use My Current Location</strong>, then tap <strong>Draw Farm Boundary</strong>.
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
                <span>{isLocating ? "Getting your current location…" : "📍 Use My Current Location"}</span>
              </button>

              <button
                type="button"
                onClick={handleStartDrawing}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <Edit3 className="w-4 h-4" />
                <span>✏️ Draw Farm Boundary</span>
              </button>
              <p className="text-[10px] text-slate-400 mt-1">
                Or search above or pan map freely
              </p>
            </div>
          </motion.div>
        )}

        {/* ================= 4. COMPACT FLOATING MEASUREMENT CARD ================= */}
        {vertices.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-24 sm:bottom-20 left-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-2xl shadow-2xl max-w-[240px] w-full text-left font-sans"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-extrabold text-[11px] text-white uppercase tracking-wider">
                  Farm Boundary
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
                <span className="text-[11px] text-slate-400">Area:</span>
                <span className="font-mono font-black text-emerald-400 text-xs">
                  {areaAcres !== null
                    ? areaUnit === "hectares"
                      ? `${acresToHectares(areaAcres).toFixed(2)} ha`
                      : `${areaAcres.toFixed(2)} acres`
                    : "Connecting..."}
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-400">Perimeter:</span>
                <span className="font-mono font-bold text-white text-xs">
                  {segmentStats.perimeterM > 1000
                    ? `${(segmentStats.perimeterM / 1000).toFixed(2)} km`
                    : `${Math.round(segmentStats.perimeterM)} m`}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400">Points:</span>
                <span className="font-mono font-semibold text-slate-300 text-[11px]">
                  {vertices.length} vertices
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= 5. FLOATING BOTTOM GUIDED HUD & ACTION BAR ================= */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-2xl flex flex-col items-center gap-2">
          {/* Active Drawing Banner */}
          {isDrawingActive ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950/90 border border-emerald-500/50 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs text-emerald-200"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-bold text-[11px] sm:text-xs">
                Drawing Active — Click corners/edges of your farm on the satellite map. ({vertices.length} points placed)
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
                <span className="hidden sm:inline">Find Farm</span>
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
                <span className="hidden sm:inline">Draw Boundary</span>
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
                <span className="hidden sm:inline">Adjust</span>
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
                <span className="hidden sm:inline">Confirm</span>
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
                  <span>Draw Farm Boundary</span>
                </button>
              )}

              {/* Editing Controls: Undo, Clear, Toggle Edit (When points exist) */}
              {vertices.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 flex items-center gap-1 text-xs font-semibold"
                    title="Undo last point"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden md:inline">Undo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 transition-all cursor-pointer border border-slate-700 flex items-center gap-1 text-xs font-semibold"
                    title="Clear boundary"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden md:inline">Clear</span>
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
                    title={isDrawingActive ? "Done adding points" : "Add more points"}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{isDrawingActive ? "Done Adding" : "Edit / Add"}</span>
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
                <span>Confirm & Save</span>
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
                <h3 className="font-black text-base text-white">Clear Farm Boundary?</h3>
                <p className="text-xs text-slate-300">
                  This will remove all {vertices.length} points and allow you to start fresh.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white cursor-pointer border-0"
                >
                  Yes, Clear
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
                    <h3 className="font-black text-base text-white">Confirm Farm Boundary</h3>
                    <p className="text-xs text-slate-400">Review surveyed measurements</p>
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
                  <span className="text-slate-400 font-medium">Farm Name:</span>
                  <span className="font-bold text-white">{plotName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Total Area:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {areaAcres !== null ? `${areaAcres.toFixed(2)} acres (${acresToHectares(areaAcres).toFixed(2)} ha)` : "--"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Perimeter:</span>
                  <span className="font-mono font-bold text-white">
                    {segmentStats.perimeterM > 1000
                      ? `${(segmentStats.perimeterM / 1000).toFixed(2)} km`
                      : `${Math.round(segmentStats.perimeterM)} m`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Boundary Points:</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {vertices.length} vertices
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  Back to Map
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer border-0 shadow-lg shadow-emerald-500/20"
                >
                  ✓ Confirm & Save Boundary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 8. API Key Configuration Modal ================= */}
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
                <p className="font-bold text-slate-300">Map Engine Status:</p>
                {mapsLoadError && (
                  <p className="text-amber-400 font-semibold">• Notice: {mapsLoadError}</p>
                )}
                <p>• If active billing is enabled on Google Cloud, <strong>Maps JavaScript API</strong> provides free monthly loads.</p>
                <p>• If no key is provided, NutriPalm seamlessly uses the high-resolution keyless satellite engine so your boundary survey continues uninterrupted.</p>
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
                  <h3 className="font-black text-base text-white">Farmer Boundary Survey Guide</h3>
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
                  <p className="font-bold text-white">1. Find Farm</p>
                  <p>Search your village/town, choose from live suggestions, or tap <strong>Use My Current Location</strong> to center the satellite map on your plot.</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">2. Draw Farm Boundary</p>
                  <p>Tap <strong>Draw Farm Boundary</strong>, then click each corner around your field perimeter.</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">3. Adjust Boundary</p>
                  <p>Drag any point to align with bunds or fences. Use <strong>Undo</strong> or <strong>Edit / Add</strong> as needed.</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white">4. Confirm & Save</p>
                  <p>Review total acreage and perimeter, then tap <strong>Confirm & Save Boundary</strong>.</p>
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
