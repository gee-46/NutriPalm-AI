
<div align="center">

# 🌱 NutriPalm AI

### AI-Powered Precision Agriculture Platform

**Digital Twins for every farm. Smarter decisions for every farmer.**

Built by **Samruddhi Organics**

<br/>

![Status](https://img.shields.io/badge/status-V1%20Integration%20Build-success?style=for-the-badge)
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
[Tech Stack](#%EF%B8%8F-tech-stack) •
[Database](#-data--database) •
[Testing](#-testing--validation) •
[Getting Started](#-getting-started) •
[Roadmap](#%EF%B8%8F-roadmap)

</div>

---

# 📖 Overview

**NutriPalm AI** is an AI-powered precision agriculture platform designed to connect farm plots, soil intelligence, crop health, digital twins and agronomic recommendations into a single system.

The platform gives each authenticated farmer a user-specific agricultural workspace where farm plots, soil reports, crop information, Digital Twin data, recommendations and analytics are connected through a common data layer.

The current **V1 build moves beyond the original visual prototype** and implements the core application workflow using:

- React + TypeScript frontend
- Supabase Authentication
- Google OAuth
- Supabase PostgreSQL
- Row Level Security (RLS)
- Python + FastAPI backend services
- Database-backed farm plots
- Soil report storage and processing pipeline
- AI recommendation persistence
- Database-backed Digital Twin data
- Account-specific dashboard synchronization
- Farm analytics

OCR-based soil report extraction is currently being integrated as the next major V1 component.

---

# 🎯 The Problem

Farmers often work with fragmented information:

- Soil laboratory reports
- Farm plot information
- Crop and growth-stage data
- Fertilizer decisions
- Historical observations
- Farm health indicators

Without connecting these datasets, agricultural decisions become difficult to optimize.

NutriPalm AI aims to create a unified agricultural intelligence layer where a farm's data can be transformed into actionable recommendations.

---

# 💡 The Solution

NutriPalm AI connects:

```text
Farmer Account
      ↓
Farm Plot
      ↓
Soil Report
      ↓
Soil Parameters
      ↓
AI Soil Analysis
      ↓
AI Recommendation
      ↓
Digital Twin
      ↓
Analytics & Farm Intelligence
````

The central concept is the **Digital Twin** — a digital representation of a farm plot that combines plot information, crop information, soil diagnostics and health indicators.

---

# 🔄 V1 WORKFLOW

The current V1 workflow is designed around authenticated, user-owned agricultural data.

```text
┌──────────────────────┐
│   User Authentication │
│ Supabase + Google OAuth
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   Farmer Profile      │
│ PostgreSQL + RLS      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│      Farm Plot        │
│ Plot + Crop + Area    │
│ Boundary information  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    Soil Report        │
│ Upload / Storage      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    OCR Pipeline       │
│ Extraction + Parsing   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Cleaning & Validation  │
│ N / P / K / pH / EC   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Structured Soil Data   │
│ PostgreSQL / Supabase  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   AI Soil Analysis     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Recommendation Engine  │
│ NPK + Application Plan │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│     Digital Twin      │
│ Health + Crop + Water │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│       Analytics       │
│ Farm-level insights   │
└──────────────────────┘
```

### Current implementation status

| Component                   | V1 Status                         |
| --------------------------- | --------------------------------- |
| User authentication         | ✅ Working                         |
| Google OAuth                | ✅ Implemented                     |
| User-specific data          | ✅ Working                         |
| Farmer profile              | ✅ Working                         |
| Farm plot creation          | ✅ Working                         |
| Plot ownership              | ✅ Working                         |
| Plot persistence            | ✅ Working                         |
| Soil report database        | ✅ Working                         |
| Soil report upload          | ✅ Working                         |
| OCR                         | 🚧 In progress                    |
| Soil value extraction       | 🚧 OCR-dependent                  |
| Soil validation             | 🚧 OCR-dependent                  |
| AI soil analysis            | ✅ Backend workflow implemented    |
| AI recommendations          | ✅ Working                         |
| Recommendation persistence  | ✅ Working                         |
| Digital Twin                | ✅ Working                         |
| Digital Twin health states  | ✅ Working                         |
| Analytics                   | ✅ Working                         |
| Account-specific dashboard  | ✅ Working                         |
| Dashboard greeting/time     | ✅ Implemented                     |
| PDF export                  | ⚠️ Requires final V1 verification |
| Real physical IoT telemetry | 🚧 Future                         |
| Live satellite intelligence | 🚧 Future                         |
| Disease detection           | 🚧 Future                         |

---

# ✨ FEATURES

## 🔐 1. Authentication & User Identity

### Technologies

* React
* TypeScript
* Supabase Auth
* Google OAuth 2.0
* Supabase JavaScript SDK
* PostgreSQL
* Row Level Security (RLS)

### Functionality

Users can authenticate and access their own agricultural workspace.

The application resolves the authenticated user and uses the account identity to load:

* User profile
* Farmers
* Farm plots
* Soil reports
* Digital Twin records
* Recommendations
* Analytics

Google OAuth provides an alternative login flow using the user's Google account.

---

# 👨‍🌾 2. Farmer Management

The Farmer Management module provides the agricultural CRM layer.

### Technologies

* React
* TypeScript
* Tailwind CSS
* Framer Motion
* Supabase
* PostgreSQL

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

The V1 dashboard is designed to derive information from the authenticated user's actual data rather than relying on global demonstration records.

---

# 🗺️ 3. Farm Plot Management

Farm plots are the central entity connecting agricultural information.

### Technologies

* React
* TypeScript
* Supabase PostgreSQL
* GIS / spatial visualization
* SVG-based visualization

### Plot data

A plot can contain information such as:

```text
Plot ID
Owner ID
Plot Name
Crop
Growth Stage
Area
Boundary
Soil Report Status
```

Plot ownership is associated with the authenticated user's account.

Example:

```text
Authenticated User
        ↓
owner_id
        ↓
Farm Plot
        ↓
Soil Report
        ↓
Digital Twin
        ↓
Recommendation
```

---

# 🧪 4. Soil Report Intelligence

Soil reports are the primary input for soil-based agricultural intelligence.

### Technologies

**Frontend**

* React
* TypeScript
* Supabase JS SDK

**Backend**

* Python
* FastAPI
* Uvicorn
* REST API

**Processing**

* OCR pipeline
* Text extraction
* Data cleaning
* Validation
* Structured soil data

### Target soil parameters

The processing pipeline is designed around agricultural parameters including:

```text
Nitrogen (N)
Phosphorus (P)
Potassium (K)
pH
Electrical Conductivity (EC)
Organic Carbon
```

### Intended V1 pipeline

```text
Actual Soil Report
        ↓
Upload
        ↓
OCR
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
Supabase PostgreSQL
        ↓
AI Soil Analysis
        ↓
Recommendation
```

### Current status

The upload/database infrastructure is working.

The **OCR extraction component is currently being completed and validated with real soil reports**.

---

# 🤖 5. AI Recommendation Engine

The Recommendation Engine converts agricultural data into actionable recommendations.

### Technologies

* React
* TypeScript
* Python
* FastAPI
* REST API
* Supabase PostgreSQL

### Recommendation workflow

```text
Farm Plot
    +
Soil Report
    ↓
Soil Parameters
    ↓
AI Soil Analysis
    ↓
Crop Context
    ↓
Recommendation Engine
    ↓
Recommendation
```

The frontend sends plot and soil-report identifiers to the recommendation API.

Example request:

```json
{
  "plot_id": "plot-uuid",
  "soil_report_id": "report-uuid",
  "crop_price_per_ton_inr": 15000
}
```

The generated recommendation is stored and can be loaded again after refreshing the application.

### V1 capabilities

* Soil-based recommendation
* Crop-aware recommendation
* Nutrient guidance
* Application planning
* Recommendation persistence
* Recommendation retrieval

---

# 🌴 6. Digital Twin Intelligence

The Digital Twin represents the current digital state of a farm plot.

### Technologies

* React
* TypeScript
* Supabase PostgreSQL
* SVG visualization
* Framer Motion

### Digital Twin data

The Digital Twin can use diagnostic information such as:

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

Example database-backed diagnostic:

```text
Crop Health:       91%
Water Stress:      38%
Nutrient Health:   88%
Growth Stage:      Vegetative
NDVI:              0.88
Yield Prediction:  5.4
Risk Level:        Low
Confidence:        94%
```

### Timeline modes

The Digital Twin supports:

```text
Past
Current
Prediction
```

These states are visualized through the Digital Twin interface.

The application automatically detects the authenticated user's available plots and can display the corresponding Digital Twin.

---

# 📊 7. Farm Analytics

Analytics is connected to the user's agricultural data.

### Technologies

* React
* TypeScript
* Supabase PostgreSQL
* SVG/chart visualizations

### Current analytics

The analytics dashboard provides information such as:

* Monitored land area
* Crop health index
* Water stress
* Yield delta
* Soil diagnostic status
* Digital Twin telemetry status
* Soil nutrient balance
* Crop distribution

Example:

```text
Authenticated User
        ↓
User-owned plots
        ↓
Plot aggregation
        ↓
Analytics calculations
        ↓
Dashboard visualization
```

The Analytics module has been tested with the user's own plot data.

---

# 🖥️ 8. Main Dashboard

The main Dashboard is account-aware.

The dashboard is **not intended to use global dummy farmer data for authenticated users**.

### Technologies

* React
* TypeScript
* Supabase
* PostgreSQL
* Tailwind CSS
* Framer Motion

### Dynamic information

The dashboard can derive:

* Registered farmers
* Mapped plots
* Digital Twin count
* Recommendations
* Total acreage
* Crop varieties
* Soil health
* Growth stages
* User identity
* Activity information

### Dynamic greeting

The greeting is determined from the user's local time.

```text
05:00 – 11:59  → Good Morning
12:00 – 16:59  → Good Afternoon
17:00 – 20:59  → Good Evening
21:00 – 04:59  → Good Night
```

The displayed name is resolved from the authenticated profile/metadata rather than using a hardcoded administrator name.

---

# 🗄️ DATA & DATABASE

NutriPalm AI uses **Supabase PostgreSQL** as the primary application data layer.

The database connects the major entities:

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
                    ├── Digital Twins
                    │
                    └── Recommendations
```

### Important principle

Data ownership is based on the authenticated user's identity.

Conceptually:

```text
auth.uid()
    ↓
owner_id
    ↓
user-owned records
```

This prevents the main application views from treating all farmers and plots as one global dataset.

---

# 🔒 SECURITY

### Technologies

* Supabase Auth
* Google OAuth
* PostgreSQL
* Row Level Security
* JWT-based authentication

The application uses authenticated sessions to associate data with the correct user.

Database-level security is used to restrict access to user-owned records where configured.

---

# 🧩 MODULE → TECHNOLOGY MAPPING

| Module                     | Primary Technologies                   |
| -------------------------- | -------------------------------------- |
| Authentication             | React, TypeScript, Supabase Auth       |
| Google Login               | Supabase Auth, Google OAuth 2.0        |
| User Profiles              | React, Supabase PostgreSQL             |
| Farmer CRM                 | React, TypeScript, Tailwind, Supabase  |
| Farm Plots                 | React, TypeScript, Supabase PostgreSQL |
| GIS Visualization          | React, SVG/GIS visualization           |
| Soil Upload                | React, TypeScript, Supabase            |
| OCR                        | Python / OCR processing pipeline       |
| Soil Processing            | Python, FastAPI                        |
| Soil Validation            | Python                                 |
| AI Soil Analysis           | Python, FastAPI                        |
| Recommendations            | Python, FastAPI, PostgreSQL            |
| Digital Twin               | React, TypeScript, Supabase            |
| Digital Twin Visualization | SVG, React, Framer Motion              |
| Analytics                  | React, TypeScript, Supabase            |
| Dashboard                  | React, TypeScript, Supabase            |
| Data Security              | Supabase Auth, PostgreSQL, RLS         |
| API Layer                  | Python, FastAPI, Uvicorn               |
| Build System               | Vite                                   |
| Styling                    | Tailwind CSS / CSS                     |
| Animation                  | Framer Motion                          |
| Icons                      | Lucide React                           |

---

# 🏗️ ARCHITECTURE

```text
                         ┌───────────────────────────┐
                         │       USER / FARMER       │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │     React + TypeScript    │
                         │       Web Application     │
                         └─────────────┬─────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
       ┌────────────────┐    ┌─────────────────┐    ┌─────────────────┐
       │ Supabase Auth  │    │ Supabase Client │    │  FastAPI Backend│
       │ Google OAuth   │    │   PostgreSQL    │    │    Python       │
       └────────────────┘    └────────┬────────┘    └────────┬────────┘
                                     │                      │
                                     │                      ▼
                                     │             ┌─────────────────┐
                                     │             │ Soil Processing │
                                     │             │ OCR / Analysis  │
                                     │             └────────┬────────┘
                                     │                      │
                                     └──────────┬───────────┘
                                                ▼
                                  ┌─────────────────────────┐
                                  │     Agricultural Data   │
                                  │                         │
                                  │ • Farmers               │
                                  │ • Plots                 │
                                  │ • Soil Reports          │
                                  │ • Digital Twins         │
                                  │ • Recommendations       │
                                  └────────────┬────────────┘
                                               │
                  ┌────────────────────────────┼─────────────────────────┐
                  │                            │                         │
                  ▼                            ▼                         ▼
        ┌─────────────────┐          ┌──────────────────┐       ┌─────────────────┐
        │ Digital Twin    │          │ Recommendation   │       │ Analytics       │
        │ Intelligence    │          │ Engine           │       │ Dashboard       │
        └─────────────────┘          └──────────────────┘       └─────────────────┘
```

---

# 🛠️ TECH STACK

## Frontend

* **React 19**
* **TypeScript**
* **Vite 8**
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
* **Google OAuth 2.0**
* **JWT sessions**

## AI / Intelligence

* Soil report OCR pipeline
* Soil parameter extraction
* Soil analysis
* AI recommendation engine
* Digital Twin diagnostic processing

## Visualization

* SVG
* React visual components
* GIS-oriented map visualization
* Interactive agricultural dashboards

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
│   ├── lib/
│   │   └── apiClient.ts
│   │
│   ├── hooks/
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
│   ├── API services
│   ├── soil processing
│   ├── recommendation services
│   └── tests/
│
├── docs/
│
├── package.json
├── requirements.txt
└── README.md
```

---

# 🧪 TESTING & VALIDATION

V1 has been validated through both frontend build checks and backend tests.

### Frontend build

```bash
npm run build
```

Expected result:

```text
tsc -b
+
vite build
=
successful production build
```

### Backend tests

```bash
python -m pytest backend/tests
```

The backend test suite has been executed successfully with:

```text
51 / 51 tests passing
```

### Manually verified V1 flows

* Authentication
* User-specific plot loading
* Plot creation
* Plot persistence
* Digital Twin plot detection
* Digital Twin diagnostic loading
* Multiple Digital Twin health states
* Recommendation generation
* Recommendation persistence after refresh
* Analytics using user plot data
* Dashboard account synchronization
* Dynamic user greeting
* Supabase database queries

---

# 🔬 VERIFIED V1 DATA FLOW

A core verified flow is:

```text
Authenticated User
       ↓
Gautam test Plot
       ↓
Plot UUID
       ↓
Digital Twin record
       ↓
Diagnostic data
       ↓
Digital Twin Health
       ↓
Current / Past / Prediction views
```

Example diagnostic record:

```text
Crop Health       → 91
Water Stress      → 38
Nutrient Health   → 88
Growth Stage      → Vegetative
NDVI              → 0.88
Yield Prediction  → 5.4
Risk Level        → Low
Confidence        → 94
```

This data is stored against the corresponding plot rather than being a purely visual dashboard value.

---

# 🚧 CURRENT V1 DEVELOPMENT

## Soil OCR

The remaining major V1 integration is the complete real-document OCR pipeline.

Target:

```text
Real PDF
   ↓
Upload
   ↓
OCR
   ↓
Text Extraction
   ↓
Cleaning
   ↓
Validation
   ↓
Structured Soil JSON
   ↓
Database
   ↓
AI Analysis
   ↓
Recommendation
```

The goal is to ensure the recommendation is generated from the **actual values extracted from the uploaded soil report**, rather than manually entered demonstration values.

---

# 🗺️ ROADMAP

## ✅ V1 — Core Agricultural Intelligence

* Authentication
* Google OAuth
* User profiles
* User-specific data
* Farmer management
* Farm plot management
* Plot persistence
* Soil report infrastructure
* Recommendation Engine
* Recommendation persistence
* Digital Twin
* Digital Twin health diagnostics
* Past / Current / Prediction views
* Analytics
* Account-aware dashboard
* Dynamic time-based greeting
* Supabase PostgreSQL integration
* RLS-based data ownership
* Python/FastAPI backend
* Automated backend testing

## 🚧 V1 Finalization

* Complete production OCR pipeline
* Real soil document extraction
* Soil-value validation
* End-to-end OCR → database → AI recommendation verification
* Final file-upload UX validation
* Final PDF export verification

## 🌍 Future Intelligence Layer

* Live IoT sensor ingestion
* Real-time telemetry
* Satellite imagery
* Live NDVI feeds
* Weather APIs
* Disease detection
* Yield prediction models
* Advanced crop models
* AI agricultural assistant
* Large-scale multi-farm monitoring

---

# 🎯 PRODUCT VISION

NutriPalm AI aims to build an agricultural intelligence platform where:

> **Every farm has a Digital Twin.
> Every soil report becomes structured intelligence.
> Every recommendation is connected to real farm data.**

The long-term goal is to combine soil intelligence, crop health, spatial information, environmental data and AI into one agricultural decision-support platform.

---

# 🚀 GETTING STARTED

## Prerequisites

* Node.js
* npm
* Python 3.x
* Supabase project

## Frontend

```bash
git clone https://github.com/gee-46/nutripalm-ai.git

cd nutripalm-ai

npm install

npm run dev
```

## Production build

```bash
npm run build
```

## Backend

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run the FastAPI backend using the project's configured entry point.

---

# ⚙️ ENVIRONMENT VARIABLES

The application requires environment-specific configuration for services such as Supabase and backend APIs.

Example frontend configuration:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Backend configuration should contain the required Supabase and API configuration.

**Never commit production secrets, service-role keys, OAuth secrets or private credentials to GitHub.**

---

# 📌 V1 STATUS

### NutriPalm AI V1 — Core Integration Build

| Area                               | Status |
| ---------------------------------- | ------ |
| Frontend                           | ✅      |
| Authentication                     | ✅      |
| Google OAuth                       | ✅      |
| Supabase                           | ✅      |
| PostgreSQL                         | ✅      |
| User data isolation                | ✅      |
| Farmer Management                  | ✅      |
| Farm Plots                         | ✅      |
| Digital Twin                       | ✅      |
| Recommendation Engine              | ✅      |
| Recommendation persistence         | ✅      |
| Analytics                          | ✅      |
| Account-aware Dashboard            | ✅      |
| Python/FastAPI backend             | ✅      |
| Soil upload                        | ✅      |
| OCR                                | 🚧     |
| End-to-end OCR recommendation flow | 🚧     |
| Advanced IoT                       | 🚧     |
| Satellite intelligence             | 🚧     |
| Disease detection                  | 🚧     |

---

# 👨‍💻 DEVELOPED BY

## Gautam N Chipkar

**AI & Data Science Engineer**

[![GitHub](https://img.shields.io/badge/GitHub-gee--46-181717?style=for-the-badge\&logo=github\&logoColor=white)](https://github.com/gee-46)

Developed under **Samruddhi Organics**.

---

<div align="center">

### 🌱 NutriPalm AI

**From soil data → agricultural intelligence → actionable decisions.**

**Built with Artificial Intelligence for smarter and more sustainable agriculture.**

</div>
