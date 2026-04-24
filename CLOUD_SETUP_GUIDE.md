# ☁️ IELTS Daily: Cloud Setup Master Guide

> [!CAUTION]
> **TOP 3 MISTAKES CAUSING AUTH ERRORS**:
> 1.  **USERNAME**: Your username is **NOT** just `postgres`. It must be `postgres.[YOUR-REF]`. 
> 2.  **SYMBOLS**: If your password has symbols like `#`, `@`, or `!`, you **MUST** encode them (e.g., `#` becomes `%23`).
> 3.  **PORT**: In the cloud, use port **6543** (not 5432).

---

## 🚀 COPY-PASTE CHEAT SHEET (Your Specific Project)

If you are using the project reference `gerrhzhfwfhcabxhxgvd`, copy and paste this into Render, replacing **ONLY** the password part:

**`DATABASE_URL`**:
`postgresql://postgres.gerrhzhfwfhcabxhxgvd:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require`

### 🔑 Password Symbol Cheat Sheet
If your password has these symbols, replace them in the string above:
| Symbol | Replace with |
| :--- | :--- |
| `@` | `%40` |
| `#` | `%23` |
| `!` | `%21` |
| `/` | `%2F` |
| `$` | `%24` |

---

## 🗄️ Step 1: Database Setup (Supabase)

1.  **Project Settings**: Go to **Project Settings** (gear icon) -> **Database**.
2.  **Connection Pooler**: Scroll down to the **Connection Pooler** section.
3.  **Mode**: Select **Transaction**.
4.  **URI**: Copy the URI provided.
    - **Verify Username**: It should start with `postgres.gerrhzhfwfhcabxhxgvd`.
    - **Verify Port**: It should end in `:6543/postgres`.

---

## ⚙️ Step 2: Backend Deployment (Render)

1.  **Connect Repo**: Connect your GitHub repo at [render.com](https://render.com).
2.  **Configure Settings**:
    - **Root Directory**: `backend`
    - **Build Command**: `pip install uv && uv pip install --system -e .`
    - **Start Command**: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3.  **Environment Variables**:
    - **DATABASE_URL**: Paste the string from the **Cheat Sheet** above.
    - **GROQ_API_KEY**: Your API key.
    - **CORS_ORIGINS**: `*` (Initially).

---

## 🌐 Step 3: Frontend Deployment (Vercel)

1.  **Project Root**: Select `frontend`.
2.  **Build Script**: Should be `npm run build` or `npx expo export -p web`.
3.  **Environment Variables**:
    - **EXPO_PUBLIC_API_URL**: Your Render URL + `/api` (e.g. `https://ielts-daily-api.onrender.com/api`).

---

---

## 🧪 Step 4: Verification

1.  **Render Logs**: Check your Render dashboard. If you see `Database ready.`, your connection is successful.
2.  **Health Check**: Visit `https://your-render-url.com/health`. You should see `{"status":"healthy"}`.

---

## 🔄 Step 5: Updating & Re-deploying

After you have deployed the app for the first time, follow these steps whenever you make changes to your code:

1.  **Test Locally**: Always ensure your app works locally before pushing.
2.  **Commit and Push**:
    ```bash
    git add .
    git commit -m "Describe your changes"
    git push origin main
    ```
3.  **Automatic Deployment**:
    - **Vercel (Frontend)**: Detects the push to GitHub and deploys automatically.
    - **Render (Backend)**: Detects the push and rebuilds the service.

### 💡 Pro Tips for Continuous Deployment:
- **New Environment Variables**: If you add a NEW variable to your local `.env` (like a new API key), you **MUST** also add it to the **Environment** settings in Render and Vercel.
- **Manual Redeploy**: If the auto-deploy doesn't start, find the **"Manual Deploy"** button in Render or the **"Redeploy"** option in Vercel's deployment tab.
