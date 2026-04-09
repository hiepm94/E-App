Some people believe that the benefits of tourism, such as job creation and foreign exchange earnings, outweigh its negative impacts, such as environmental degradation and cultural disruption. Others argue that the negative impacts of tourism far outweigh its benefits. Discuss both views and give your own opinion.# 🎓 IELTS Daily — Premium AI Learning Hub

A state-of-the-art, full-stack IELTS and English learning application. Powered by high-priority **Groq** and **NVIDIA** AI models, it provides instant speaking transcription, writing evaluations, and context-aware lexical resource generation.

---

## 🚀 5-Minute Quickstart

### 1. Backend (Python/uv)

```bash
cd backend
cp .env.example .env  # Add your GROQ_API_KEY
uv venv && source .venv/bin/activate
uv pip install -e .
uv run uvicorn app.main:app --reload
```

_API docs available at: http://localhost:8000/docs_

### 2. Frontend (Expo/NPM)

```bash
cd frontend
npm install
npx expo start --web
```

_App launches at: http://localhost:8081_

---

## 📦 Prerequisites

Ensure you have the following installed on your local machine:

- **Python 3.10+** (Recommend using `uv` for lightning-fast management)
- **Node.js 18+** & **npm**
- **Git**
- **API Keys**: At least one key from [Groq](https://console.groq.com) (Recommended for speed) or [NVIDIA](https://build.nvidia.com).

---

## 💻 Local Development

### 🐍 Backend Setup

The backend uses **FastAPI** and **SQLModel**. By default, it uses a local SQLite database for effortless setup.

1. **Environment**: Create `backend/.env` and add:
   ```dotenv
   GROQ_API_KEY=gsk_...
   NVIDIA_API_KEY=nvapi-...
   ```
2. **Database**: The database is automatically initialized on the first run as `ielts_daily.db`.

### ⚛️ Frontend Setup

The frontend is built with **Expo** (React Native). It is optimized for Web but supports iOS/Android via Expo Go.

1. **Local Mode**: By default, the frontend connects to `http://localhost:8000`. No `.env` is required for local development.
2. **Cloud Mode**: To use your deployed backend during local development, create `frontend/.env`:
   ```dotenv
   EXPO_PUBLIC_API_URL=https://your-app.onrender.com/api
   ```

---

## ☁️ Cloud Deployment

For a detailed, step-by-step walkthrough of deploying to **Supabase**, **Render**, and **Vercel**, please refer to our dedicated guide:

👉 **[Master Cloud Setup Guide](file:///Users/ander/Project/E-App/CLOUD_SETUP_GUIDE.md)**

### Brief Overview:

1.  **Database**: Create a project on Supabase and note your PostgreSQL URI.
2.  **Backend**: Deploy the `backend` folder to Render with your `DATABASE_URL` and AI keys.
3.  **Frontend**: Deploy the `frontend` folder to Vercel and set `EXPO_PUBLIC_API_URL`.

---

## 🔧 Configuration Reference

### Backend (`backend/.env`)

| Key              | Default         | Description                                          |
| ---------------- | --------------- | ---------------------------------------------------- |
| `GROQ_API_KEY`   | -               | **Primary AI Provider.** Used for 3.3-70B & Whisper. |
| `NVIDIA_API_KEY` | -               | **Fallback AI Provider.** Used if Groq fails.        |
| `DATABASE_URL`   | `sqlite:///...` | Use `postgresql://...` for cloud production.         |
| `CORS_ORIGINS`   | `*`             | Comma-separated list of allowed origins.             |

### Frontend (`frontend/.env`)

| Key                   | Default                     | Description                                  |
| --------------------- | --------------------------- | -------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000/api` | Point this to your Render URL for cloud use. |

---

## 🧪 Verification & Troubleshooting

### Check Backend Health

Visit `https://your-app.onrender.com/api/` or `http://localhost:8000/`. You should receive a `"healthy"` status.

### Common Issues

- **CORS Errors**: Ensure your frontend URL is added to `CORS_ORIGINS` in the backend.
- **AI Timeout**: We have configured high timeouts (90s+) for LLM calls, but ensure your API keys have sufficient credits/quota.
- **Database Locked**: If using SQLite, ensure only one process is writing to the file at a time.

---

## 📁 Project Structure

- `backend/app/services/llm.py`: **Core AI Logic.** (Groq priority configuration).
- `backend/app/services/prompts.py`: **Prompt Engineering.** All AI instructions live here.
- `frontend/src/screens/`: **UI Modules.** Vocab Hub, Practice Center, and Daily Journal.
- `frontend/src/theme.js`: **Design System.** Centralized colors and shadows.
