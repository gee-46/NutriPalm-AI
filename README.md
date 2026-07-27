<div align="center">

# 🌱 NutriPalm AI

### AI-Powered Precision Agriculture Platform

**Digital Twins for every farm. Smarter decisions for every farmer.**

Built by **Samruddhi Organics**

<br/>

![Status](https://img.shields.io/badge/status-Phase%201%20Prototype-orange?style=for-the-badge)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

[Overview](#-overview) • [Features](#-features) • [Architecture](#-architecture) • [Tech Stack](#%EF%B8%8F-tech-stack) • [Getting Started](#-getting-started) • [Roadmap](#%EF%B8%8F-roadmap)

</div>

<br/>

---

## 📖 Overview

**NutriPalm AI** is an intelligent AgriTech platform that bridges the gap between traditional farming and modern agricultural intelligence. It gives every farm a living **Digital Twin** — a unified digital representation of soil, crop, and plot data that powers AI-driven fertilizer recommendations and farm insights.

This repository contains the **Phase 1 incubation prototype**: a fully designed front-end experience showcasing the product vision, user journey, and interface for the platform ahead of backend and AI integration.

<table>
<tr>
<td width="50%" valign="top">

### The Problem
Farmers today lack accessible, data-driven tools to understand soil health, optimize fertilizer use, and make timely agricultural decisions — leading to overuse of inputs, reduced yields, and unsustainable practices.

</td>
<td width="50%" valign="top">

### The Solution
A unified digital platform where every farm plot has a Digital Twin — combining soil reports, crop data, and location intelligence to deliver precise, AI-backed fertilizer and farming recommendations.

</td>
</tr>
</table>

<br/>

## 🧭 Product Journey

<div align="center">

| Step | Stage | Description |
|:---:|---|---|
| 01 | **Landing Page** | Introduces the platform and its vision |
| 02 | **About NutriPalm AI** | Explains the mission and value proposition |
| 03 | **Farmer Registration** | Farmers create digital profiles |
| 04 | **Plot Creation** | Digital farm plots are mapped and defined |
| 05 | **Digital Twin** | A virtual model of the farm is generated |
| 06 | **Soil Report Upload** | Soil data is captured for analysis |
| 07 | **AI Recommendation** | Fertilizer and nutrient guidance is generated |
| 08 | **Analytics Dashboard** | Farm insights are visualized over time |

</div>

<br/>

## ✨ Features

NutriPalm AI is equipped with a high-fidelity suite of interactive agronomist screens, custom data visualizations, and telemetry simulators:

<table>
<tr>
<td width="50%" valign="top">

### 👨‍🌾 Farmer CRM Registry
- **Search & Filters**: Match landholders by name/ID, and filter by crop type, district, acreage, and active status.
- **Dynamic Table**: Interactive records showing avatars, soil indexes, last inspections, and status badges.
- **Profile Detail Drawer**: Slide-out panel detailing contacts, twin parameters, and NPK historical advisories.
- **Wizard Modal**: Multi-step popup modal guiding users through farmer info, plots specs, and success validation.

</td>
<td width="50%" valign="top">

### 🛰️ Farm Plot GIS Management
- **Interactive SVG Map**: 5 distinct plots color-coded by crop vigor index.
- **GIS Satellite Toolbar**: Interactive layers for satellite maps, terrain, boundaries, NDVI index, and zooming.
- **Environmental Snapshot**: Solar radiation, UV index, temperatures, and wind metrics.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🌴 Flagship Digital Twin Intelligence
- **Biophysical palm model**: Interactive oil palm crop with hover hotspots for Temperature, Moisture, NDVI, and Foliar health.
- **Simulation Switcher**: Toggles mock telemetry calculations between **Past**, **Current**, and **Prediction** modes.
- **NDVI Trend Chart**: SVG line chart tracking vegetation levels with 7d/30d/90d filters.

</td>
<td width="50%" valign="top">

### 🧪 Soil Report AI OCR Diagnostic
- **Drag-and-Drop Chamber**: Mock document dropzone with a pre-loaded sample report option.
- **Holographic OCR Scanner**: Scanning green laser line overlay simulating text extraction.
- **Live Diagnostics Console**: Scrolling terminal logs tracking raw coordinates and chemical extraction counts.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💡 AI Crop Recommendation Engine
- **Dosage Plan**: Rings/foliar scheduling detailing quantities, application methods, and times.
- **ROI Valuation**: Capital costs ($225), revenue gains ($540), and estimated **140% ROI** with a 28-day break-even period.
- **Timeline Roadmap**: Implementation calendar outlining actions from Day 1 to Day 45.

</td>
<td width="50%" valign="top">

### 📈 AI Farm Analytics Dashboard
- **Six KPI Sparklines**: Count-ups for Farmers, Plots, Prescriptions, Health, Yields, and Active IoT Nodes.
- **Crop Doughnut Chart**: Slice segments highlighting oil palm, rice, sugarcane, and cocoa area splits.
- **Farm Health Heatmap**: Color-coded blocks mapping farm health. Hovering reveals landholder and crop type details.

</td>
</tr>
</table>

<br/>

## 🎯 Vision

> To build an AI-powered Digital Agriculture Platform where **every farm has its own Digital Twin** — enabling smarter, more sustainable, and more precise farming practices at scale.

<br/>

## 🏗️ Architecture

```
                    ┌─────────────────────────┐
                    │      Farmer Portal       │
                    │   (React + TypeScript)   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │      Digital Twin Layer   │
                    │  (Plot • Crop • Soil data) │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
    │   Soil Intelligence│ │  AI Recommendation│ │   Analytics    │
    │   (OCR + Reports)  │ │      Engine       │ │   Dashboard    │
    └────────────────────┘ └────────────────────┘ └────────────────┘
```

*Backend, AI services, and GIS intelligence are planned for Phase 2 and Phase 3 (see [Roadmap](#%EF%B8%8F-roadmap)).*

<br/>

## 🛠️ Tech Stack

<table>
<tr>
<td valign="top" width="33%">

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React

</td>
<td valign="top" width="33%">

**Planned Backend**
- FastAPI
- PostgreSQL
- PostGIS
- pgvector

</td>
<td valign="top" width="33%">

**Planned AI**
- OCR
- Large Language Models
- AI Recommendation Engine
- GIS Intelligence
- Digital Twin Architecture

</td>
</tr>
</table>

<br/>

## 🎨 Design Philosophy

NutriPalm AI follows a modern, startup-grade design system inspired by products like **Stripe**, **Linear**, **Vercel**, **Apple**, and **Notion** — prioritizing:

`Clean layouts` `Premium typography` `Smooth animation` `Minimalism` `Responsive UX`

<br/>

## 📂 Project Structure

```
nutripalm-ai/
├── public/              # Static public assets & logos
├── src/                 # Application source
│   ├── assets/          # Project specific icons & graphics
│   ├── components/      # Reusable front-end UI structures
│   │   └── prototype/   # High-fidelity console screen modules
│   ├── App.tsx          # Main route state routing shell
│   ├── index.css        # Centralized Geist Design System styling
│   └── main.tsx         # Project react entrypoint
├── docs/                # Built compilation walkthrough logs
├── package.json         # Retained production dependencies lists
├── requirements.txt     # System requirements & prerequisites documentation
└── README.md            # Incubation proposal & specifications
```

<br/>

## 🚀 Getting Started

**Prerequisites:** Node.js and npm installed on your machine.

```bash
# 1. Clone the repository
git clone https://github.com/gee-46/nutripalm-ai.git

# 2. Navigate to the project
cd nutripalm-ai

# 3. Install dependencies
npm install

# 4. Run the development server
npm run dev
```

<br/>

## 🛣️ Roadmap

<table>
<tr>
<td width="33%" valign="top">

### ✅ Phase 1 — Prototype
- Landing page
- Product vision
- Prototype UI
- Dashboard
- Digital Twin screens
- Recommendation workflow

</td>
<td width="33%" valign="top">

### 🚧 Phase 2 — Core Platform
- Authentication
- Farmer database
- Plot management
- Soil report processing
- OCR integration
- AI recommendation logic

</td>
<td width="33%" valign="top">

### 🌍 Phase 3 — Intelligence Layer
- Weather intelligence
- Satellite monitoring
- Crop disease detection
- Yield prediction
- IoT integration
- AI farm assistant

</td>
</tr>
</table>

<br/>

## 📌 Current Status

✅ **Phase 1 Incubation Prototype Complete & Finalized**

This repository currently hosts the fully polished, high-fidelity AgriTech SaaS console showing all active visual simulation controls, OCR scanner terminals, Digital Twin overlays, and multi-step wizards, verified for production compiler runs.

<br/>

## 🤝 Contributing

Contributions, ideas, and feedback are welcome. Please open an [issue](https://github.com/gee-46/nutripalm-ai/issues) or submit a pull request if you'd like to help improve the project.

<br/>

## 📄 License

This project is developed as part of **Samruddhi Organics**. All rights reserved unless otherwise specified.

<br/>

---

<div align="center">

## 👨💻 Developed By

**Gautam N Chipkar**
*AI & Data Science Engineer*

[![GitHub](https://img.shields.io/badge/GitHub-gee--46-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/gee-46)

<br/>

**🌱 Built with the vision of transforming agriculture through Artificial Intelligence.**
- Centralized Geist Design System & coordinates 404 handler implemented in July 2026.

</div>
