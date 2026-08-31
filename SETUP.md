# NutriPalm AI -- Setup & Configuration Guide

## Overview

NutriPalm AI is a precision agriculture advisory platform combining:
- **OCR Pipeline** (Tesseract + Poppler) for soil report extraction
- **FastAPI backend** with JWT-secured endpoints
- **React frontend** (Vite + TypeScript) with Supabase integration
- **AI Recommendation Engine** for crop advisory generation

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.x | Frontend runtime |
| Python | >= 3.11 | Backend runtime |
| Tesseract OCR | >= 5.x | Soil report image parsing |
| Poppler | >= 26.x | PDF-to-image rendering |

---

## 1. Clone & Install

```bash
git clone https://github.com/gee-46/NutriPalm-AI.git
cd NutriPalm-AI
npm install
cd backend && pip install -r requirements.txt
```

---

## 2. Environment Variables

### Frontend (.env in root)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://localhost:8001
```

### Backend (backend/.env)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Authentication - Supabase Dashboard -> Project Settings -> API -> JWT Secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# OCR Engine Paths
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
POPPLER_PATH=D:\tools\poppler-26.02.0\Library\bin

CORS_ORIGINS=http://localhost:5173,http://localhost:4173
```

---

## 3. JWT Authentication

The backend verifies Supabase-issued JWTs on all protected routes.

### How it works

```
Browser -> POST /api/soil-reports/upload
           Authorization: Bearer <supabase-access-token>
             |
           FastAPI auth/jwt_dependency.py
             |
           1. Extract Bearer token
           2. Verify against SUPABASE_JWT_SECRET
           3. Validate expiry, aud, iss, sub
           4. Inject user_id into route handler
```

### Getting Your JWT Secret

1. Go to Supabase Dashboard
2. Project Settings -> API -> JWT Settings
3. Copy JWT Secret -> paste as SUPABASE_JWT_SECRET

### Protected Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | /api/soil-reports/upload | Bearer JWT |
| GET | /api/recommendations/{id} | Bearer JWT |
| GET | /api/health | Public |

---

## 4. Supabase Database Schema

### soil_reports table

```sql
CREATE TABLE soil_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID REFERENCES plots(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nitrogen_kg_ha NUMERIC,
  phosphorus_kg_ha NUMERIC,
  potassium_kg_ha NUMERIC,
  organic_carbon_percent NUMERIC,
  ph NUMERIC,
  electrical_conductivity NUMERIC,
  zinc_mg_kg NUMERIC,
  sulphur_mg_kg NUMERIC,
  boron_mg_kg NUMERIC,
  iron_mg_kg NUMERIC,
  manganese_ppm NUMERIC,
  copper_mg_kg NUMERIC,
  status TEXT DEFAULT 'Completed',
  source_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE soil_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reports" ON soil_reports
  USING (auth.uid() = owner_id);
```

---

## 5. Running Locally

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload --port 8001

# Frontend (from project root)
npm run dev
```

API docs: http://localhost:8001/docs

---

## 6. Running Tests

```bash
python -m pytest backend/tests -v
# Expected: 97 passed
```

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 on upload | Check SUPABASE_JWT_SECRET |
| 404 on /api/soil-reports/upload | Ensure backend running on 8001 |
| OCR empty text | Verify Tesseract + Poppler in PATH |
| area_unit validation error | Use 'acre' not 'acres' in DB |
| CORS errors | Add frontend origin to CORS_ORIGINS |
