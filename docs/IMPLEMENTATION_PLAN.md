# CineSnap — Implementation Plan

## MVP → Production Roadmap

---

## Phase 1 — MVP (Weeks 1–3)

**Goal:** Working end-to-end scan on a single device.

### Week 1: Backend foundation
- [ ] Set up FastAPI project structure
- [ ] Implement VisionAgent (Google Vision OCR + labels)
- [ ] Implement SearchAgent (TMDb text search + OMDB cross-ref)
- [ ] Manual test with static test frames (movie title cards)
- [ ] Deploy to Railway/Fly.io behind HTTPS

### Week 2: Review + Scoring pipeline
- [ ] Implement ReviewAgent (OMDB Tier 1 ratings)
- [ ] Implement ScoringAgent (weighted average + outlier removal)
- [ ] Implement ExplanationAgent (Claude synthesis)
- [ ] Integrate all 5 agents into the Orchestrator pipeline
- [ ] Add `/scan/frame` and `/scan/result/{id}` endpoints

### Week 3: Mobile app
- [ ] Expo project setup with camera permissions
- [ ] Build Scanner screen (camera → submit → poll → result)
- [ ] Build ResultCard, ScoreGauge, VerdictBadge components
- [ ] Local watchlist with AsyncStorage
- [ ] Test on iOS simulator + Android emulator

**MVP Definition of Done:**
- Point at a movie title card → get score within 5 seconds
- Works for top 1000 movies (IMDb most popular)
- Watchlist saves/removes correctly

---

## Phase 2 — Enrichment (Weeks 4–6)

**Goal:** More sources, better accuracy, polished UX.

### Backend
- [ ] Add Tier 2 review sources (Letterboxd, Reddit via Claude)
- [ ] Add Redis caching for repeated tmdb_id lookups (TTL: 24h)
- [ ] Add rate limiting middleware
- [ ] Add TV show support (episode identification)
- [ ] Add WebSocket streaming for real-time progress
- [ ] Add confidence threshold tuning based on test data

### Mobile
- [ ] WebSocket progress updates (smooth animated stages)
- [ ] Full Result Detail screen (`/result/[id]`)
- [ ] Share sheet integration
- [ ] Recent scans history (last 20)
- [ ] Dark theme polish + haptic feedback on scan complete
- [ ] Handle poor network gracefully (retry + timeout UI)

---

## Phase 3 — Intelligence (Weeks 7–10)

**Goal:** Handle edge cases, add audio fingerprinting, foreign content.

### Backend
- [ ] Audio fingerprinting integration (ACRCloud API)
  - Captures a ~5-second audio clip alongside frames
  - Dramatically improves TV show identification
- [ ] Foreign language content support
  - TMDb supports 40+ languages
  - Fallback to English title for scoring
- [ ] Live TV detection
  - Check if content is currently airing via TMDb "on the air"
  - Special handling: current episode vs. whole series score
- [ ] Review bias detection
  - Flag review bombs (sudden score drops) using vote timeline
  - Downweight outlier periods in temporal scoring
- [ ] Persistent scan cache (PostgreSQL)

### Mobile
- [ ] Audio clip capture alongside frame capture
- [ ] Partial frame / glare detection UI guidance
- [ ] Onboarding walkthrough
- [ ] Notification: "Your scan from earlier was identified!" (background)

---

## Phase 4 — Scale (Months 3–6)

**Goal:** Production-ready, multiple users, 99.9% uptime.

- [ ] Replace in-memory scan store with Redis + PostgreSQL
- [ ] Add worker queue (Celery or ARQ) for pipeline jobs
- [ ] Horizontal scaling (multiple FastAPI workers)
- [ ] CDN for poster images
- [ ] Analytics dashboard (scan success rate, top titles, avg latency)
- [ ] Optional user accounts for cross-device watchlist sync
- [ ] App Store / Play Store submission

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google Vision OCR fails on glare/blur | High | High | Fallback to audio fingerprint; guide user |
| TMDb returns wrong match | Medium | High | Fuzzy + manual search fallback |
| OMDB rate limit exceeded | Medium | Medium | Redis cache; exponential backoff |
| Claude API latency spike | Low | Medium | Timeout + fallback explanation template |
| TV show identified as wrong season | Medium | Low | Episode-level data not shown in v1; whole-series score only |
| Review score missing for niche content | High (niche) | Low | Graceful fallback: show available sources only |
| Camera frame too dark / blurry | High | Medium | Real-time frame quality check before submit |
| Foreign language OCR inaccurate | Medium | Medium | Google Vision language hints; TMDb multi-language search |

---

## Wireframe Reference (Text)

```
┌─────────────────────────────────┐
│         CineSnap                │  ← Header (camera mode, transparent)
│      Point at any screen        │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │   [Live camera feed]    │    │
│  │                         │    │
│  │   [Screen detection     │    │
│  │    rectangle overlay]   │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│           ◉  Tap to scan        │  ← Large circular shutter button
└─────────────────────────────────┘

After scan (bottom sheet slides up):
┌─────────────────────────────────┐
│  ▬▬▬  (drag handle)            │
│                                 │
│  [Poster]   ★ 4.3/5            │
│  Oppenheimer  ┌──────────┐     │
│  2023 · Drama │  WATCH ✓ │     │
│               └──────────┘     │
│                                 │
│  Critics 4.5  Audience 4.2      │
│  Sentiment 4.1                  │
│                                 │
│  "A visually stunning epic..."  │
│  ✓ Career-defining performance  │
│  ✓ Nolan at his finest          │
│  ✕ 3-hour runtime               │
│                                 │
│  [+ Watchlist]     [Share]      │
│  [View all sources →]           │
│                                 │
│  [Scan Again]                   │
└─────────────────────────────────┘
```
