# CineSnap — AI Movie Critic

> Point your phone at any TV screen and instantly know: **Watch, Skip, or Maybe?**

CineSnap uses computer vision, audio fingerprinting, and a multi-agent AI pipeline to identify content playing on any screen and deliver a fast, unbiased, aggregated review score from 10+ trusted sources — in under 5 seconds.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CINESNAP SYSTEM                               │
│                                                                       │
│  ┌──────────────┐    ┌─────────────────────────────────────────────┐ │
│  │  Mobile App  │    │              Backend API (FastAPI)           │ │
│  │  (Expo RN)   │    │                                              │ │
│  │              │    │  ┌───────────┐   ┌────────────────────────┐ │ │
│  │  [Camera]    │───▶│  │  Vision   │──▶│    Orchestrator        │ │ │
│  │  [Scanner]   │    │  │  Agent    │   │    (async pipeline)    │ │ │
│  │  [Results]   │◀───│  └───────────┘   │                        │ │ │
│  │  [Watchlist] │    │                  │ ┌──────────────────────┤ │ │
│  └──────────────┘    │  ┌───────────┐   │ │  Search Agent        │ │ │
│                      │  │  Google   │──▶│ │  (TMDb/OMDB)         │ │ │
│                      │  │  Vision   │   │ ├──────────────────────┤ │ │
│                      │  │  API      │   │ │  Review Agent        │ │ │
│                      │  └───────────┘   │ │  (10+ sources)       │ │ │
│                      │                  │ ├──────────────────────┤ │ │
│                      │  ┌───────────┐   │ │  Scoring Agent       │ │ │
│                      │  │  Claude   │──▶│ │  (weighted 1–5)      │ │ │
│                      │  │  API      │   │ ├──────────────────────┤ │ │
│                      │  └───────────┘   │ │  Explanation Agent   │ │ │
│                      │                  │ │  (pros/cons/summary) │ │ │
│                      │                  │ └──────────────────────┤ │ │
│                      │                  └────────────────────────┘ │ │
│                      └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in your API keys
uvicorn main:app --reload --port 8000
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

---

## Project Structure

```
AI_Movie_Critic/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md       # Full system design
│   └── API_DESIGN.md         # REST + WebSocket API spec
├── backend/
│   ├── main.py               # FastAPI app entry
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/               # 5 specialized AI agents
│   │   ├── vision_agent.py
│   │   ├── search_agent.py
│   │   ├── review_agent.py
│   │   ├── scoring_agent.py
│   │   └── explanation_agent.py
│   ├── models/               # Pydantic data models
│   │   ├── content.py
│   │   └── review.py
│   ├── services/             # External API wrappers
│   │   ├── tmdb_service.py
│   │   └── omdb_service.py
│   └── routers/
│       └── scan.py
└── mobile/
    ├── app/                  # Expo Router screens
    │   ├── (tabs)/
    │   │   ├── index.tsx     # Camera scanner (home)
    │   │   ├── watchlist.tsx
    │   │   └── settings.tsx
    │   └── result/[id].tsx   # Result detail screen
    ├── components/           # UI building blocks
    ├── hooks/                # Business logic hooks
    ├── services/             # API + local storage
    └── constants/theme.ts
```

---

## Key Features

| Feature | Implementation |
|---|---|
| Screen Recognition | Google Vision API + frame diff hashing |
| Content ID | TMDb visual search + OMDB cross-reference |
| Review Aggregation | Claude agent queries 10+ sources |
| Scoring | Weighted: Critics 40%, Audience 40%, Sentiment 20% |
| Verdict | Watch / Skip / Optional with confidence % |
| Privacy | Frames processed in-memory, never persisted |

---

## API Keys Required

- `ANTHROPIC_API_KEY` — Claude AI agents
- `TMDB_API_KEY` — Movie/TV metadata + posters
- `OMDB_API_KEY` — IMDb/RT/Metacritic ratings
- `GOOGLE_VISION_API_KEY` — Frame text/logo extraction
- `SERPAPI_KEY` — Reddit/Letterboxd sentiment scraping
