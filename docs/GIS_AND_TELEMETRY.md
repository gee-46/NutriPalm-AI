# NutriPalm AI: GIS Mapping & Digital Twin Telemetry Architecture

This document details the GIS boundary surveying protocols, satellite telemetry ingestion pipelines, and digital twin simulation lifecycle for NutriPalm AI.

## 1. GIS Boundary Capture & Geodesic Calculation
NutriPalm AI supports multiple geospatial ingestion vectors:
- **Interactive Map Surveyor**: Full-screen satellite portal with GPS geolocation centering, vertex snapping, and live perimeter measurement using the spherical Haversine formula.
- **GeoJSON Importer**: Direct parser supporting GeoJSON `Polygon`, `Feature`, and `FeatureCollection` formats with automated bounding box calculation.
- **Precision Acres Conversion**: High-precision square meter to acre conversion ($1\text{ ac} = 4046.8564\text{ m}^2$) with minimum and maximum acreage safety guards.

## 2. Real-Time Telemetry & Weather Ingestion
- **Open-Meteo Integration**: Real-time ECMWF/GFS global forecast models queried per plot centroid coordinate.
- **WMO Code Classification**: Automated weather hazard severity rating (low, moderate, severe) to alert farmers before fertilizer application.
- **In-Memory Centroid Caching**: 10-minute caching to eliminate unnecessary external API polling during dashboard navigation.

## 3. Digital Twin Synchronization Lifecycle
1. **Soil Diagnostic Core**: Extraction of N-P-K, pH, EC, Organic Carbon, and Micronutrients (Zn, Fe, Mn, Cu, B, S) from certified laboratory PDF reports.
2. **Sentinel-2 NDVI Calibration**: Bi-weekly satellite biomass scans calculating vegetative density and moisture stress indices.
3. **Twin Simulation Engine**: Multi-layer biophysical modeling predicting vegetative growth stage, disease risk probabilities, and yield potential.
