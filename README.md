
<div align="center">

# 🌱 NutriPalm AI

### AI-Powered Precision Agriculture Platform

**Digital Twins for every farm. Smarter decisions for every farmer.**

Built by **Samruddhi Organics**

<br/>

![Status](https://img.shields.io/badge/status-V1%20Complete-success?style=for-the-badge)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Python](https://img.shields.io/badge/Python-Backend-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?style=for-the-badge&logo=fastapi&logoColor=white)

<br/>

[Overview](#-overview) •
[Workflow](#-v1-workflow) •
[Features](#-features) •
[Architecture](#-architecture) •
[Tech Stack](#️-tech-stack) •
[Database](#-data--database) •
[Testing](#-testing--validation) •
[Getting Started](#-getting-started) •
[Roadmap](#️-roadmap)

</div>

---

# 📖 Overview

**NutriPalm AI** is an agricultural intelligence platform designed to connect farm plots, soil intelligence, crop information, Digital Twin visualization, recommendations and farm analytics into a unified system.

The platform provides each authenticated farmer with a user-specific agricultural workspace where farm plots, soil reports, recommendations and analytics are connected through a common data layer.

The current **V1 build is an integrated working prototype** containing:

- User authentication
- Google OAuth
- Farmer management
- Farm plot management
- Supabase PostgreSQL persistence
- Row Level Security
- Real soil-report PDF upload
- Tesseract-based OCR
- Soil parameter extraction
- Soil validation
- Dynamic agronomic recommendations
- Fertilizer dosage calculations
- Cost and ROI estimation
- Digital Twin V1 visualization
- Farm analytics
- OCR-to-Analytics data mapping
- Dynamic farmer/plot context
- Advisory PDF export
- Automated backend testing

---

# 🎯 The Problem

Farmers often work with fragmented agricultural information:

- Soil laboratory reports
- Farm plot information
- Crop and growth-stage data
- Fertilizer decisions
- Soil health indicators
- Historical observations
- Farm health information

When these datasets are disconnected, it becomes difficult to transform agricultural information into actionable decisions.

NutriPalm AI aims to create a unified agricultural intelligence layer where farm data can be transformed into understandable recommendations and farm insights.

---

# 💡 The Solution

NutriPalm AI connects the core agricultural workflow:

```text
Farmer Account
      ↓
Farm Plot
      ↓
Soil Report
      ↓
OCR Extraction
      ↓
Soil Parameters
      ↓
Validation
      ↓
Structured Soil Data
      ↓
Supabase
      ↓
 ┌────┴─────────────┐
 ↓                  ↓
Recommendations   Analytics
 ↓
Advisory Plan
 ↓
PDF Export
````

The platform also contains a **Digital Twin V1** representing the current digital state and diagnostic information associated with a farm plot.

The Digital Twin is currently a separate V1 visualization/intelligence layer and is **not claimed to be directly driven by OCR soil reports**.

---

# 🔄 V1 WORKFLOW

The current V1 workflow is designed around authenticated, user-owned agricultural data.

```text
┌─────────────────────────┐
│    User Authentication  │
│   Supabase + OAuth      │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│     Farmer Profile      │
│     PostgreSQL + RLS    │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│       Farm Plot         │
│ Plot + Crop + Area      │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│    Soil Report PDF      │
│       Upload            │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│       OCR Pipeline      │
│ Tesseract + Processing  │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│ Extraction & Validation  │
│ N/P/K/pH/EC/Micros      │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│   Structured Soil Data  │
│     Supabase Database   │
└────────────┬────────────┘
             ↓
       ┌─────┴─────┐
       ↓           ↓
┌────────────┐ ┌────────────┐
│Recommendation│ │ Analytics │
│   Engine     │ │ Dashboard │
└─────┬────────┘ └────────────┘
      ↓
┌─────────────────────────┐
│    Advisory PDF Export  │
└─────────────────────────┘
```

---

# ✅ Current V1 Implementation Status

| Component                          | V1 Status     |
| ---------------------------------- | ------------- |
| User authentication                | ✅ Working     |
| Google OAuth                       | ✅ Working     |
| User-specific data                 | ✅ Working     |
| Farmer profile                     | ✅ Working     |
| Farmer management                  | ✅ Working     |
| Farm plot creation                 | ✅ Working     |
| Plot ownership                     | ✅ Working     |
| Plot persistence                   | ✅ Working     |
| Soil report database               | ✅ Working     |
| Soil report upload                 | ✅ Working     |
| Real OCR                           | ✅ Working     |
| Soil value extraction              | ✅ Working     |
| Soil validation                    | ✅ Working     |
| Macronutrient extraction           | ✅ Working     |
| Micronutrient extraction           | ✅ Working     |
| OCR persistence                    | ✅ Working     |
| V1 recommendation engine           | ✅ Working     |
| Dynamic fertilizer recommendations | ✅ Working     |
| Fertilizer dosage calculations     | ✅ Working     |
| Cost / ROI calculations            | ✅ Working     |
| Recommendation persistence         | ✅ Working     |
| Digital Twin V1                    | ✅ Working     |
| Digital Twin health states         | ✅ Working     |
| Analytics V1                       | ✅ Working     |
| OCR → Analytics mapping            | ✅ Implemented |
| Account-specific dashboard         | ✅ Working     |
| Dynamic farmer identity            | ✅ Working     |
| PDF advisory export                | ✅ Working     |
| Backend automated tests            | ✅ 97 passed   |
| Frontend production build          | ✅ Passing     |
| Real PDF testing                   | ✅ Tested      |
| Physical IoT telemetry             | 🚧 Future     |
| Live satellite intelligence        | 🚧 Future     |
| Live weather intelligence          | 🚧 Future     |
| GPS farm-boundary capture          | 🚧 Future     |
| Disease detection                  | 🚧 Future     |

---

# ✨ FEATURES

## 🔐 1. Authentication & User Identity

### Technologies

* React
* TypeScript
* Supabase Auth
* Google OAuth
* Supabase JavaScript SDK
* PostgreSQL
* Row Level Security

### Functionality

Authenticated users access their own agricultural workspace.

The application uses the authenticated account to associate:

* User profile
* Farmers
* Farm plots
* Soil reports
* Recommendations
* Analytics
* Digital Twin records

The farmer identity displayed throughout the application is dynamically resolved from the authenticated user/profile context.

---

# 👨‍🌾 2. Farmer Management

The Farmer Management module provides the agricultural CRM layer.

### Features

* Farmer registration
* Farmer profiles
* Farmer identification
* Location information
* Crop information
* Farm area
* Soil health indicators
* Farmer search
* Filtering
* Status indicators
* Farmer detail views

User-specific agricultural data is associated with the authenticated account.

---

# 🗺️ 3. Farm Plot Management

Farm plots are the central agricultural entity connecting farm information.

### Plot information

A plot can contain:

```text
Plot ID
Owner ID
Plot Name
Crop
Growth Stage
Area
Area Unit
Boundary Information
Soil Report Status
```

Plot ownership is associated with the authenticated user.

Conceptually:

```text
Authenticated User
        ↓
     owner_id
        ↓
     Farm Plot
        ↓
   Soil Reports
        ↓
 Recommendations
```

---

# 🧪 4. Soil Report Intelligence

Soil reports are a major input into the V1 agricultural intelligence workflow.

## Processing Stack

### Frontend

* React
* TypeScript
* Supabase JavaScript SDK

### Backend

* Python
* FastAPI
* Uvicorn
* REST APIs

### OCR / Processing

* Tesseract OCR
* PDF processing
* Text extraction
* Layout-aware parsing
* Data cleaning
* Validation
* Structured soil data

---

## Supported Soil Parameters

The V1 extraction workflow handles:

```text
Nitrogen (N)
Phosphorus (P)
Potassium (K)
pH
Electrical Conductivity (EC)
Organic Carbon
Zinc
Sulphur
Boron
Iron
Manganese
Copper
```

---

## V1 OCR Pipeline

```text
Real Soil Report PDF
        ↓
      Upload
        ↓
    PDF Processing
        ↓
     Tesseract OCR
        ↓
      Raw Text
        ↓
   Text Extraction
        ↓
       Cleaning
        ↓
      Validation
        ↓
 Structured Soil JSON
        ↓
      Supabase
        ↓
 Recommendation / Analytics
```

The V1 OCR pipeline has been tested against multiple real soil-report PDFs.

The extraction logic also accounts for common OCR formatting variations and supports inequality-style values such as:

```text
> 5
< 1
```

The system should not be interpreted as guaranteeing perfect extraction for every possible laboratory report format.

---

# 🤖 5. V1 Recommendation Engine

The V1 Recommendation Engine converts extracted soil information into actionable agronomic guidance.

The current implementation uses a **deterministic rule-based agronomic approach** rather than claiming to be a trained machine-learning model.

## Recommendation Flow

```text
Actual Soil Values
        ↓
Nutrient Status Evaluation
        ↓
Deficiency / Adequacy Diagnosis
        ↓
Fertilizer Selection
        ↓
Dose Calculation
        ↓
Plot-Area Adjustment
        ↓
Cost / ROI Estimation
        ↓
Recommendation
```

### V1 capabilities

* Soil-based recommendations
* Nutrient deficiency detection
* Nutrient adequacy detection
* Crop-aware context
* Fertilizer recommendations
* Application planning
* Plot-area-aware quantities
* Estimated fertilizer costs
* Yield improvement estimates
* ROI calculations
* Recommendation persistence

---

## Example

A soil report containing:

```text
Nitrogen:   211 kg/ha
Phosphorus: 23.46 kg/ha
Potassium:  319 kg/ha
pH:         5.81
```

can be evaluated against the V1 agronomic thresholds.

The recommendation layer can then identify deficient parameters and generate corresponding fertilizer/application guidance.

---

# 📄 6. Advisory PDF Export

NutriPalm AI provides client-side advisory report generation using **jsPDF**.

The exported advisory report contains dynamic information from the active agricultural context.

### Included information

* Farmer
* Plot
* Crop
* Area
* Growth phase
* Soil analysis
* Extracted soil values
* Units
* Agronomic ranges
* Nutrient status
* Recommendation summary
* Fertilizer dosage
* Required quantities
* Estimated costs
* Diagnoses
* Cost-benefit information
* ROI information
* Advisory disclaimer

Both:

```text
Export PDF
```

and:

```text
Download Advisory PDF
```

use the same export workflow.

---

# 🌴 7. Digital Twin V1

The Digital Twin represents the digital state of a farm plot.

### V1 technologies

* React
* TypeScript
* Supabase PostgreSQL
* SVG visualization
* Framer Motion

### V1 diagnostic information

The Digital Twin interface can represent:

```text
Crop Health
Water Stress
Nutrient Health
Growth Stage
NDVI
Yield Prediction
Risk Level
Confidence Score
Analysis Date
```

### Timeline modes

```text
Past
Current
Prediction
```

The current Digital Twin is a **V1 prototype/visual intelligence layer**.

It uses the project's available plot and diagnostic data.

### Important V1 scope boundary

Physical sensors, live IoT telemetry, satellite imagery, weather APIs and mobile GPS collection are **not currently implemented as live data sources**.

These belong to future versions.

---

# 📊 8. Farm Analytics

Analytics provides a farm-level view of agricultural information.

### Current V1 analytics

The dashboard can represent:

* Monitored land area
* Crop health
* Water stress
* Yield delta
* Soil diagnostic status
* Digital Twin telemetry/diagnostic status
* Soil nutrient information
* Crop distribution
* Plot-level information

---

## OCR → Analytics

Persisted soil reports can be queried from Supabase and mapped into the Analytics data model.

The current mapping includes database fields such as:

```text
nitrogen_kg_ha
phosphorus_kg_ha
potassium_kg_ha
organic_carbon_percent
ph
electrical_conductivity
created_at
```

These are mapped to the frontend analytics metrics.

Conceptually:

```text
Soil Report PDF
      ↓
     OCR
      ↓
Validated Soil Values
      ↓
Supabase soil_reports
      ↓
useFarmerAnalytics
      ↓
Analytics Dashboard
```

This allows real persisted soil-report information to participate in V1 Analytics where the corresponding metric is supported.

---

# 🖥️ 9. Main Dashboard

The main dashboard is account-aware.

The application resolves the authenticated user's agricultural information rather than treating all farmers as one global dataset.

### Dynamic information

The dashboard can derive:

* Registered farmers
* Mapped plots
* Digital Twin information
* Recommendations
* Total acreage
* Crop information
* Soil health
* Growth stages
* User identity
* Activity information

### Dynamic greeting

The greeting changes according to local time:

```text
05:00 – 11:59  → Good Morning
12:00 – 16:59  → Good Afternoon
17:00 – 20:59  → Good Evening
21:00 – 04:59  → Good Night
```

---

# 🗄️ DATA & DATABASE

NutriPalm AI uses **Supabase PostgreSQL** as the primary application data layer.

The major entities are connected conceptually as:

```text
Users
  │
  └── Profiles
        │
        └── Farmers
              │
              └── Farm Plots
                    │
                    ├── Soil Reports
                    │
                    ├── Digital Twin Data
                    │
                    └── Recommendations
```

---

## Data Ownership

The application uses authenticated identity to associate user-owned records.

Conceptually:

```text
auth.uid()
    ↓
owner_id
    ↓
User-Owned Records
```

Row Level Security is used where configured to protect user-owned data.

---

# 🔒 SECURITY

### Technologies

* Supabase Auth
* Google OAuth
* PostgreSQL
* Row Level Security
* JWT-based authentication

The application uses authenticated sessions to associate agricultural data with the correct user.

### Important

Never commit:

* Supabase service-role keys
* OAuth secrets
* API secrets
* Production credentials
* Private keys

to GitHub.

---

# 🧩 MODULE → TECHNOLOGY MAPPING

| Module                     | Primary Technologies                    |
| -------------------------- | --------------------------------------- |
| Authentication             | React, TypeScript, Supabase Auth        |
| Google Login               | Supabase Auth, Google OAuth             |
| User Profiles              | React, Supabase PostgreSQL              |
| Farmer Management          | React, TypeScript, Tailwind, Supabase   |
| Farm Plots                 | React, TypeScript, Supabase PostgreSQL  |
| Map Visualization          | React, SVG / GIS-oriented visualization |
| Soil Upload                | React, TypeScript, Supabase             |
| OCR                        | Python, Tesseract                       |
| Soil Processing            | Python, FastAPI                         |
| Soil Validation            | Python                                  |
| Recommendation Engine      | TypeScript / Python application logic   |
| Digital Twin               | React, TypeScript, Supabase             |
| Digital Twin Visualization | SVG, React, Framer Motion               |
| Analytics                  | React, TypeScript, Supabase             |
| Dashboard                  | React, TypeScript, Supabase             |
| PDF Export                 | jsPDF                                   |
| Database                   | Supabase PostgreSQL                     |
| Data Security              | Supabase Auth, PostgreSQL, RLS          |
| API Layer                  | Python, FastAPI, Uvicorn                |
| Build System               | Vite                                    |
| Styling                    | Tailwind CSS / CSS                      |
| Animation                  | Framer Motion                           |
| Icons                      | Lucide React                            |

---

# 🏗️ ARCHITECTURE

```text
                         ┌───────────────────────┐
                         │   USER / FARMER       │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ React + TypeScript    │
                         │ Web Application       │
                         └───────────┬───────────┘
                                     │
             ┌───────────────────────┼───────────────────────┐
             │                       │                       │
             ▼                       ▼                       ▼
     ┌───────────────┐      ┌────────────────┐     ┌────────────────┐
     │ Supabase Auth │      │ Supabase Client│     │ FastAPI Backend│
     │ Google OAuth  │      │ PostgreSQL     │     │ Python         │
     └───────────────┘      └───────┬────────┘     └───────┬────────┘
                                    │                      │
                                    │                      ▼
                                    │              ┌────────────────┐
                                    │              │ Soil Processing│
                                    │              │ OCR / Parsing  │
                                    │              └───────┬────────┘
                                    │                      │
                                    └──────────┬───────────┘
                                               ▼
                                  ┌────────────────────────┐
                                  │ Agricultural Data      │
                                  │                        │
                                  │ • Farmers              │
                                  │ • Plots                │
                                  │ • Soil Reports         │
                                  │ • Recommendations      │
                                  │ • Digital Twin Data    │
                                  └────────────┬───────────┘
                                               │
                         ┌─────────────────────┼───────────────────┐
                         │                     │                   │
                         ▼                     ▼                   ▼
                 ┌──────────────┐      ┌───────────────┐   ┌────────────┐
                 │ Digital Twin │      │ Recommendation│   │ Analytics  │
                 │ V1           │      │ Engine        │   │ Dashboard  │
                 └──────────────┘      └───────┬───────┘   └────────────┘
                                               │
                                               ▼
                                      ┌────────────────┐
                                      │ Advisory PDF   │
                                      └────────────────┘
```

---

# 🛠️ TECH STACK

## Frontend

* **React 19**
* **TypeScript**
* **Vite**
* **Tailwind CSS**
* **Framer Motion**
* **Lucide React**

## Backend

* **Python**
* **FastAPI**
* **Uvicorn**
* **REST APIs**

## Database

* **Supabase**
* **PostgreSQL**
* **Row Level Security**

## Authentication

* **Supabase Auth**
* **Google OAuth**
* **JWT sessions**

## OCR / Intelligence

* **Tesseract OCR**
* Soil parameter extraction
* Soil validation
* Rule-based V1 recommendation engine
* Digital Twin diagnostics

## Visualization

* SVG
* React components
* GIS-oriented visualization
* Interactive dashboards

## PDF

* **jsPDF**

---

# 📂 PROJECT STRUCTURE

```text
nutripalm-ai/
│
├── public/
│   └── static assets
│
├── src/
│   ├── assets/
│   │
│   ├── components/
│   │   ├── prototype/
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── FarmPlotScreen.tsx
│   │   │   ├── DigitalTwinScreen.tsx
│   │   │   ├── SoilReportScreen.tsx
│   │   │   ├── RecommendationScreen.tsx
│   │   │   ├── AnalyticsScreen.tsx
│   │   │   └── ...
│   │   │
│   │   └── shared components
│   │
│   ├── hooks/
│   │
│   ├── lib/
│   │   └── apiClient.ts
│   │
│   ├── data/
│   │
│   ├── translation/
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── repositories/
│   │   ├── ocr/
│   │   └── ...
│   │
│   ├── tests/
│   └── ...
│
├── docs/
│
├── package.json
├── requirements.txt
└── README.md
```

---

# 🧪 TESTING & VALIDATION

V1 has been validated through automated backend testing, frontend production builds and manual real-document testing.

## Frontend Build

```bash
npm run build
```

### Result

```text
Production build successful
TypeScript compilation successful
Vite build successful
```

---

## Backend Tests

```bash
python -m pytest backend/tests -v
```

### Current verified result

```text
97 passed
0 failed
```

---

## Manually Tested V1 Flows

The following workflows have been tested during V1 development:

* Authentication
* User-specific data
* Farmer management
* Plot creation
* Plot persistence
* Soil PDF upload
* Real OCR processing
* Soil parameter extraction
* OCR validation
* Recommendation generation
* Dynamic fertilizer calculations
* Analytics data mapping
* Dynamic farmer identity
* Advisory PDF generation
* Supabase database interaction
* Frontend production build

Multiple real soil-report PDFs have been used during OCR testing.

---

# 🔬 VERIFIED SOIL INTELLIGENCE FLOW

The key V1 soil workflow is:

```text
Real Soil Report
       ↓
PDF Upload
       ↓
Tesseract OCR
       ↓
Text / Layout Processing
       ↓
Parameter Extraction
       ↓
Validation
       ↓
Structured Soil Data
       ↓
Supabase soil_reports
       ↓
┌──────┴────────┐
↓               ↓
Analytics   Recommendation
                ↓
          Advisory PDF
```

This is the primary integrated intelligence workflow of NutriPalm AI V1.

---

# 📍 FARM LOCATION & BOUNDARIES

The current V1 web application can work with available browser/device location context where supported by the existing application.

However, **precise farm-boundary capture is not yet a production GIS feature**.

The following are future capabilities:

* Satellite-drawn farm boundaries
* Mobile GPS boundary capture
* Walking around the farm to collect GPS points
* Satellite-assisted boundary verification
* GPS-based boundary adjustment

### Recommended future approach

A future version can combine:

```text
Satellite Initial Boundary
          ↓
Mobile GPS Verification
          ↓
Farmer Adjustment
          ↓
Final Farm Polygon
```

Mobile GPS-based collection is particularly suited to a future mobile application where device location services can provide more precise field-level data.

---

# 🚧 V1 SCOPE BOUNDARIES

NutriPalm AI V1 should be understood as an **integrated agricultural prototype**, not yet as a fully deployed precision-agriculture hardware platform.

### Implemented in V1

* User management
* Farm management
* Plot management
* Soil report OCR
* Soil validation
* Soil persistence
* Rule-based recommendations
* Fertilizer calculations
* Analytics
* Digital Twin visualization
* Advisory PDF export

### Not yet implemented as live intelligence

* Physical IoT sensors
* Real-time soil sensors
* Live weather APIs
* Live satellite imagery
* Live NDVI feeds
* Mobile GPS field tracking
* Automatic disease detection
* Production ML yield forecasting

These are intentionally part of the future roadmap.

---

# 🗺️ ROADMAP

## ✅ V1 — Core Agricultural Intelligence

* Authentication
* Google OAuth
* User profiles
* Farmer Management
* Farm Plot Management
* Plot persistence
* Soil report upload
* Real OCR
* Soil parameter extraction
* Soil validation
* Supabase persistence
* V1 Recommendation Engine
* Dynamic fertilizer dosage
* Cost / ROI calculations
* Digital Twin V1
* Digital Twin health visualization
* Past / Current / Prediction views
* Analytics V1
* OCR → Analytics mapping
* Account-aware dashboard
* Dynamic farmer identity
* Advisory PDF export
* FastAPI backend
* Automated backend testing

---

# 🟡 V1 FINALIZATION

The core V1 implementation is complete.

Remaining work is primarily:

* Final end-to-end demonstration
* Final UI/UX polish
* Repository cleanup
* Documentation cleanup
* Final regression testing
* Final GitHub release/commit

These are finalization activities rather than new core features.

---

# 🌍 V2 — FUTURE INTELLIGENCE

## IoT

* Physical soil sensors
* Moisture sensors
* Temperature sensors
* EC sensors
* Real-time telemetry
* Sensor alerts

## Satellite Intelligence

* Satellite imagery
* NDVI feeds
* Vegetation monitoring
* Crop stress detection
* Satellite-assisted farm boundaries

## Weather

* Live weather APIs
* Rainfall predictions
* Temperature forecasts
* Irrigation recommendations
* Weather-aware crop decisions

## GIS / Mobile

* Mobile GPS farm mapping
* Walk-around GPS boundary capture
* Satellite + GPS boundary verification
* High-precision field polygons

## AI / ML

* Disease detection
* Computer vision crop analysis
* ML yield prediction
* Advanced crop models
* Predictive soil health
* AI agricultural assistant

## Scale

* Multi-farm monitoring
* Enterprise agricultural intelligence
* Regional farm analytics
* Large-scale crop monitoring

---

# 🎯 PRODUCT VISION

NutriPalm AI aims to build an agricultural intelligence platform where:

> **Every farm has a Digital Twin.**
> **Every soil report becomes structured intelligence.**
> **Every recommendation is connected to real farm data.**

The long-term vision is to combine:

```text
Soil Intelligence
      +
Farm Spatial Data
      +
Crop Health
      +
IoT
      +
Satellite Data
      +
Weather
      +
Artificial Intelligence
      ↓
Agricultural Decision Intelligence
```

The goal is to help farmers and agricultural organizations move from fragmented data to actionable, data-driven decisions.

---

# 🚀 GETTING STARTED

## Prerequisites

Install:

* Node.js
* npm
* Python 3.x
* Supabase project

For local OCR/PDF processing, the development environment also requires the project's configured OCR/PDF processing dependencies.

---

# 💻 FRONTEND

Clone the repository:

```bash
git clone https://github.com/gee-46/NutriPalm-AI.git
```

Enter the project:

```bash
cd NutriPalm-AI
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The Vite development server will normally be available at:

```text
http://localhost:5173
```

---

# 🐍 BACKEND

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI backend using the configured application entry point.

Example:

```bash
cd backend
python -m uvicorn app.main:app --reload
```

The development API will normally be available at:

```text
http://127.0.0.1:8000
```

---

# 🏗️ PRODUCTION BUILD

Run:

```bash
npm run build
```

The command creates the production frontend bundle using Vite.

---

# ⚙️ ENVIRONMENT VARIABLES

Frontend configuration requires environment-specific Supabase values.

Example:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Backend configuration should contain the required Supabase and API configuration.

Never commit:

```text
Service-role keys
OAuth secrets
Private API keys
Production credentials
JWT secrets
```

to GitHub.

---

# 📌 V1 STATUS

## NutriPalm AI V1 — Integrated Core Build

| Area                       | Status      |
| -------------------------- | ----------- |
| Frontend                   | ✅           |
| Authentication             | ✅           |
| Google OAuth               | ✅           |
| Supabase                   | ✅           |
| PostgreSQL                 | ✅           |
| User data isolation        | ✅           |
| Farmer Management          | ✅           |
| Farm Plots                 | ✅           |
| Soil Upload                | ✅           |
| Real OCR                   | ✅           |
| Soil Extraction            | ✅           |
| Soil Validation            | ✅           |
| Soil Persistence           | ✅           |
| Recommendation Engine      | ✅           |
| Recommendation Persistence | ✅           |
| Fertilizer Dosage          | ✅           |
| Cost / ROI                 | ✅           |
| Digital Twin V1            | ✅           |
| Analytics V1               | ✅           |
| OCR → Analytics            | ✅           |
| Account-aware Dashboard    | ✅           |
| Dynamic Farmer Identity    | ✅           |
| Advisory PDF Export        | ✅           |
| Python / FastAPI Backend   | ✅           |
| Automated Backend Tests    | ✅ 97 Passed |
| Production Build           | ✅           |
| IoT Telemetry              | 🚧 Future   |
| Satellite Intelligence     | 🚧 Future   |
| Live Weather               | 🚧 Future   |
| GPS Farm Mapping           | 🚧 Future   |
| Disease Detection          | 🚧 Future   |
| Advanced ML                | 🚧 Future   |

---

# 🏁 V1 CONCLUSION

**NutriPalm AI V1 is functionally complete as an integrated agricultural prototype.**

The current build demonstrates the core workflow:

```text
Authenticated Farmer
        ↓
Farm Plot
        ↓
Real Soil Report PDF
        ↓
OCR
        ↓
Soil Extraction
        ↓
Validation
        ↓
Database Persistence
        ↓
Dynamic Recommendation
        ↓
Analytics
        ↓
Advisory PDF
```

The V1 establishes the foundation for future agricultural intelligence integrations.

Advanced live intelligence — including IoT, satellite, weather, mobile GPS mapping, disease detection and advanced machine learning — is intentionally reserved for future versions.

---

# 👨‍💻 DEVELOPED BY

## Gautam N Chipkar & Team

**AI & Data Science Engineer**

[![GitHub](https://img.shields.io/badge/GitHub-gee--46-181717?style=for-the-badge\&logo=github\&logoColor=white)](https://github.com/gee-46)

Developed under **Samruddhi Organics**.

---

<div align="center">

### 🌱 NutriPalm AI

**From soil data → agricultural intelligence → actionable decisions.**

**Built with Artificial Intelligence for smarter and more sustainable agriculture.**

</div>
