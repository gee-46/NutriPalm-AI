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

<table>
<tr>
<td width="33%" valign="top">

### 🌾 Farmer Management
- Farmer registration & profiles
- Digital farmer records
- Farm profile management

</td>
<td width="33%" valign="top">

### 🗺️ Plot Management
- Farm boundary visualization
- GPS location support
- Digital plot creation

</td>
<td width="33%" valign="top">

### 🌱 Digital Twin
- Virtual farm representation
- Crop & soil metadata
- Live farm state modeling

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📄 Soil Intelligence
- Soil report upload
- Nutrient visualization
- Soil health indicators

</td>
<td width="33%" valign="top">

### 🤖 AI Recommendation Engine
- Fertilizer recommendations
- Nutrient deficiency analysis
- Smart agricultural insights

</td>
<td width="33%" valign="top">

### 📊 Analytics Dashboard
- Farm statistics
- Recommendation history
- Interactive visual charts

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
src/
├── components/     # Reusable UI building blocks
├── pages/          # Route-level views
├── layouts/        # Page and section layouts
├── assets/         # Images, icons, static media
├── hooks/          # Custom React hooks
├── utils/          # Helper functions & utilities
├── animations/     # Framer Motion animation configs
├── constants/      # App-wide constants
└── styles/         # Global and Tailwind styles
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

🚧 **Phase 1 Prototype in Development**

This repository currently showcases the user experience and product demonstration layer. Backend functionality, AI services, and third-party integrations will be introduced in future development phases.

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
