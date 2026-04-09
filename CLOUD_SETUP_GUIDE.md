# ☁️ IELTS Daily: Master Cloud Setup Guide

This guide provides a detailed, step-by-step walkthrough for deploying the IELTS Daily application to the cloud using **Supabase** (Database), **Render** (Backend), and **Vercel** (Frontend).

---

## 🏗️ Architecture Overview

The application follows a standard full-stack architecture:
1.  **Database**: Supabase (PostgreSQL) — Stores all users, vocabulary, and practice data.
2.  **Backend**: Render (FastAPI) — Handles AI logic, scraping, and database orchestration.
3.  **Frontend**: Vercel (React Native Web) — The primary user interface.

---

## 🗄️ Step 1: Database Setup (Supabase)

Supabase gives you a professional-grade PostgreSQL database for free.

1.  **Create Project**: Go to [supabase.com](https://supabase.com) and create a **New Project**.
2.  **Database Password**: Note down your database password immediately. You will need it in Step 2.
3.  **Get Connection String**:
    - Go to **Project Settings** (gear icon) -> **Database**.
    - Scroll to **Connection string**.
    - Select **URI**.
    - Copy the string. It looks like this:
      `postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres`
    - **Crucial**: Replace `[YOUR-PASSWORD]` with your actual password.

---

## ⚙️ Step 2: Backend Deployment (Render)

Render will host your Python API. It will automatically detect your `render.yaml` configuration.

1.  **Connect Repo**: Go to [render.com](https://render.com) -> **New** -> **Web Service**.
2.  **Select Repository**: Connect your GitHub repository containing the code.
3.  **Configure Settings**:
    - **Name**: `ielts-daily-api`
    - **Root Directory**: `backend`
    - **Runtime**: `Python`
    - **Build Command**: `pip install uv && uv pip install --system -e .`
    - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4.  **Environment Variables**:
    - Add `DATABASE_URL` -> Paste your connection string from Step 1.
    - Add `GROQ_API_KEY` -> Your key from [console.groq.com](https://console.groq.com).
    - Add `NVIDIA_API_KEY` -> Your key from [build.nvidia.com](https://build.nvidia.com).
    - Add `CORS_ORIGINS` -> `*` (Keep as `*` initially; update in Step 4).
5.  **Deploy**: Click **Deploy Web Service**.

---

## 🌐 Step 3: Frontend Deployment (Vercel)

Vercel is the best home for the React Native/Expo web app.

1.  **Connect Repo**: Go to [vercel.com](https://vercel.com) -> **Add New** -> **Project**.
2.  **Configure Settings**:
    - **Root Directory**: Select `frontend`.
    - **Framework Preset**: select `Other` (Vercel usually auto-detects Vite or Next, but for Expo it's `Other`).
    - **Build Command**: `npx expo export:web`
    - **Output Directory**: `dist`
3.  **Environment Variables**:
    - Add `EXPO_PUBLIC_API_URL` -> Your Render URL + `/api` (e.g., `https://ielts-daily-api.onrender.com/api`).
4.  **Deploy**: Click **Deploy**.

---

## 🧪 Step 4: Final Connectivity & CORS

Once both are deployed, you must "handshake" them.

1.  **Copy Vercel URL**: Get your frontend URL (e.g., `https://ielts-daily.vercel.app`).
2.  **Update Render CORS**:
    - Go back to your Render Dashboard -> **Environment**.
    - Edit `CORS_ORIGINS`.
    - Add your Vercel URL: `https://ielts-daily.vercel.app,exp://`
    - Save and wait for Render to redeploy.
3.  **Verify**: Open your Vercel site. If you see the vocabulary items or can generate a journal entry, the cloud setup is **Stable and Consistent**.

---

## 🛠️ Troubleshooting

-   **Database Error?** Check that you replaced `[YOUR-PASSWORD]` in the connection string.
-   **AI Timeout?** Render's free tier sometimes sleeps. The first request might take 30 seconds to "wake up" the server.
-   **Blank Page?** Open the browser console (Right-click -> Inspect -> Console). If you see a "CORS" error, double-check your `CORS_ORIGINS` in Render.
