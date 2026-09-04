# Google Maps Platform Setup & Farm Boundary Survey Guide

## Overview

NutriPalm AI integrates the **Google Maps JavaScript API** to provide farmers with a **true full-screen satellite mapping experience** for drawing and surveying farm plot boundaries.

High-resolution satellite imagery enables farmers to visually delineate their farm perimeter along physical ground features (tree lines, irrigation bunds, fences, and field paths).

---

## 1. Required Google Maps Platform APIs

Only **ONE** Google Cloud API is required for this boundary survey feature:

| API Name | Purpose | SKU Consumed |
| :--- | :--- | :--- |
| **Maps JavaScript API** | Interactive full-screen satellite map, polygon drawing, vertex dragging, and hybrid basemap views | **Dynamic Maps** |

> [!NOTE]
> Do **NOT** enable unnecessary APIs (e.g., Directions, Distance Matrix, Street View, Geolocation API). This keeps your Google Cloud footprint minimal and avoids unexpected billing.

---

## 2. Environment Variable Configuration

Add your Google Maps API key to `.env.local` in the project root:

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyYourActualGoogleMapsApiKeyHere
```

> [!CAUTION]
> Never commit `.env.local` or any file containing real API keys to version control. `.env.local` is already included in `.gitignore`.

---

## 3. Google Cloud Setup Steps

1. **Create / Select a Project**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project named `NutriPalm-AI` or select an existing project.

2. **Link a Billing Account**:
   - Go to **Billing** in the Google Cloud Console.
   - Link a valid billing account (required by Google to activate Maps Platform APIs).

3. **Enable Maps JavaScript API**:
   - Navigate to **APIs & Services** → **Library**.
   - Search for **Maps JavaScript API**.
   - Click **Enable**.

4. **Generate & Restrict API Key**:
   - Go to **APIs & Services** → **Credentials**.
   - Click **Create Credentials** → **API key**.
   - Click **Edit API key** to configure security restrictions:
     - **API restrictions**: Select **Restrict key** and check only **Maps JavaScript API**.
     - **Application restrictions**: For local development, set HTTP referrers to `http://localhost:*` and `http://127.0.0.1:*`. For production, add your deployment domain.
   - Copy the API key and paste it into `.env.local` as `VITE_GOOGLE_MAPS_API_KEY`.

---

## 4. Google Maps Platform Pricing & Free Usage

*Last verified against Google Maps Platform documentation (March 2025–2026 pricing model).*

### Key Pricing Rules:
- **Per-SKU Monthly Free Allowance**: Google retired the flat $200/month pooled credit on March 1, 2025, and replaced it with independent per-SKU free allowances.
- **Dynamic Maps SKU (Global)**: Includes **10,000 free map loads per month** per billing account.
- **Dynamic Maps SKU (India)**: Includes **70,000 free map loads per month** for projects based in India.
- **Hackathon & Trial Safety**: Standard hackathon testing and demo usage typically uses under 1,000 map loads, fitting well within the monthly free tier ($0 expected cost).
- **Billing Requirement**: Google requires a billing-enabled account with a valid payment method on file, even when usage remains entirely within the free tier.
- **Cost Protection**: We recommend setting a **Budget Alert** (e.g., $1.00 threshold) in the Google Cloud Billing Console to prevent accidental overages.

---

## 5. Architectural Data Distinctions & Technical Integrity

### A. Delineation vs. Survey Accuracy
- **Visual Delineation**: Google Maps provides high-resolution satellite imagery for visual field delineation.
- **Honest GPS Reporting**: Standard mobile phone and browser GPS provides typical positioning accuracy between ±5 m and ±20 m. NutriPalm explicitly displays the device's reported accuracy radius rather than claiming RTK/centimeter-level precision.
- **Farmer GPS/Map Boundary ≠ Government Cadastral Boundary**:
  - The farmer-drawn boundary represents the **operational farm management boundary** used for satellite crop health monitoring and telemetry.
  - It is distinct from government cadastral parcel records (e.g., Karnataka Bhu-Naksha).

### B. GeoJSON Contract (EPSG:4326)
The boundary is stored and transmitted using the standard NutriPalm GeoJSON format:
```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [78.4948, 17.3912],
      [78.4980, 17.3912],
      [78.4980, 17.3940],
      [78.4948, 17.3940],
      [78.4948, 17.3912]
    ]
  ]
}
```
- Coordinate order: `[longitude, latitude]`
- Reference system: WGS84 (EPSG:4326)
- Linear ring is closed (first and last vertex coordinates match).

### C. Downstream Integrations Preserved
- **Sentinel-2 & NDVI**: Sentinel Hub API queries use this exact GeoJSON polygon to fetch spectral bands and compute NDVI vegetation health indices.
- **Open-Meteo Weather**: Uses the polygon centroid for hyper-local environmental forecasts.
- **Digital Twin**: Simulates telemetry, soil moisture, and crop health models on the plot polygon.
- **Supabase RLS**: Real plot boundaries are saved in the `plots.boundary` JSONB column with strict user ownership policies.
