# CineSnap — Deployment Guide
## Live in ~10 minutes · 100% Free

Two services to deploy:
- **Backend** → [Render.com](https://render.com) (FastAPI + Python)
- **Frontend** → [Netlify.com](https://netlify.com) (Static HTML)

---

## STEP 1 — Push to GitHub

You need a GitHub repo first.

```bash
# In the project root
cd C:\Users\HQNORNC\Claude_projects\AI_Movie_Critic

git init
git add .
git commit -m "Initial CineSnap deployment"
```

Then go to https://github.com/new → create a new repo → copy the remote URL, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/cinesnap.git
git branch -M main
git push -u origin main
```

---

## STEP 2 — Deploy Backend to Render

### 2a. Create a Render account
Go to → **https://render.com** → Sign up (free, no credit card)

### 2b. New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub account → Select the `cinesnap` repo
3. Fill in these settings:

| Field | Value |
|---|---|
| **Name** | `cinesnap-api` |
| **Root Directory** | `backend` |
| **Runtime** | `Docker` |
| **Instance Type** | `Free` |

4. Click **"Advanced"** → **"Add Environment Variable"** — add all 5 keys:

```
ANTHROPIC_API_KEY     = sk-ant-api03-...
TMDB_API_KEY          = your key
OMDB_API_KEY          = your key
GOOGLE_VISION_API_KEY = your key
SERPAPI_KEY           = your key
ENVIRONMENT           = production
```

5. Click **"Create Web Service"**
6. Wait ~3 minutes for it to build and deploy
7. Your backend URL will be:
   ```
   https://cinesnap-api.onrender.com
   ```
   ✅ Test it: open `https://cinesnap-api.onrender.com/health` — should return `{"status":"ok"}`

---

## STEP 3 — Update Frontend with Your Backend URL

Open this file:
```
C:\Users\HQNORNC\Claude_projects\AI_Movie_Critic\web\config.js
```

Change the URL to your actual Render URL:
```js
window.CINESNAP_API = 'https://cinesnap-api.onrender.com';
```

Save the file.

---

## STEP 4 — Deploy Frontend to Netlify

### Option A: Drag & Drop (fastest — 30 seconds)

1. Go to → **https://netlify.com** → Sign up free
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag and drop the entire **`web/`** folder onto the page
4. Netlify gives you an instant URL like:
   ```
   https://rainbow-sundae-abc123.netlify.app
   ```
5. ✅ **Share this URL** — anyone in the world can use CineSnap!

### Option B: Deploy from GitHub (auto-updates on push)

1. **"Add new site"** → **"Import an existing project"** → GitHub
2. Select your `cinesnap` repo
3. Settings:

| Field | Value |
|---|---|
| **Base directory** | `web` |
| **Publish directory** | `web` |
| Build command | *(leave empty)* |

4. Click **"Deploy site"**

---

## STEP 5 — Custom Domain (Optional)

In Netlify dashboard → **"Domain settings"** → **"Add custom domain"**

Example: `cinesnap.yourdomain.com` — free SSL certificate auto-provisioned.

---

## Final Architecture (Live)

```
User's Browser
      │
      ▼
Netlify CDN  (static HTML — global edge)
https://your-site.netlify.app
      │  API calls
      ▼
Render.com  (FastAPI backend — Python)
https://cinesnap-api.onrender.com
      │
      ├── Anthropic Claude API
      ├── TMDb API
      ├── OMDB API
      └── Google Vision API
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Render build fails | Check logs in Render dashboard → "Logs" tab |
| "API Offline" on Netlify | Make sure `config.js` has the correct Render URL |
| Render free tier sleeps after 15min | First request takes ~30s to wake up — this is normal on free tier |
| CORS error in browser | Already handled — backend allows all origins |
| SSL error on Render | Remove `verify=False` from httpx clients (already fixed for local dev) |

---

## Upgrade Path (When You're Ready)

| Need | Solution | Cost |
|---|---|---|
| No cold starts | Render Starter plan | $7/mo |
| Custom domain | Already free on Netlify | $0 |
| More API calls | Upgrade Anthropic/TMDb plans | Varies |
| Mobile app (iOS/Android) | Submit Expo build to stores | $99/yr Apple, $25 Google |
