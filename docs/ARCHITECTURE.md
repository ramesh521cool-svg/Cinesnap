# CineSnap — System Architecture

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER DEVICE (iOS/Android)                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      React Native (Expo) App                         │ │
│  │                                                                       │ │
│  │  Screen 1: Scanner          Screen 2: Result          Screen 3: List │ │
│  │  ┌──────────────────┐       ┌────────────────┐       ┌────────────┐ │ │
│  │  │ [Camera Preview] │       │ [Poster]       │       │ Watchlist  │ │ │
│  │  │                  │  ───▶ │ Title + Year   │       │ ─────────  │ │ │
│  │  │  [Scan Button]   │       │ ★★★★☆  4.1    │       │ Item 1     │ │ │
│  │  │                  │       │ [WATCH ✓]      │       │ Item 2     │ │ │
│  │  │  [Status: idle]  │       │ Pros / Cons    │       │ Item 3     │ │ │
│  │  └──────────────────┘       └────────────────┘       └────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  HTTPS + WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI / Python)                         │
│                                                                           │
│  POST /scan/frame ──▶ Orchestrator ──▶ parallel agent pipeline          │
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │   Vision    │  │   Search    │  │   Review    │  │   Scoring     │  │
│  │   Agent     │  │   Agent     │  │   Agent     │  │   Agent       │  │
│  │             │  │             │  │             │  │               │  │
│  │ • OCR text  │  │ • TMDb API  │  │ • IMDb      │  │ • Normalize   │  │
│  │ • Logo det. │  │ • OMDB      │  │ • RT        │  │ • Weight      │  │
│  │ • Scene cls │  │ • Fuzzy     │  │ • Metacrit  │  │ • Outlier rm  │  │
│  │ • Perceptual│  │   match     │  │ • Letterboxd│  │ • Confidence  │  │
│  │   hash      │  │             │  │ • Reddit    │  │               │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘  │
│         │                │                │                  │           │
│         └────────────────┴────────────────┴──────────────────┘           │
│                                      │                                    │
│                              ┌───────▼──────┐                            │
│                              │  Explanation │                            │
│                              │  Agent       │                            │
│                              │ (Claude LLM) │                            │
│                              └──────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Agent Pipeline

### Agent Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT PIPELINE                           │
│                                                              │
│  Input: Base64 frame(s) from phone camera                   │
│                                                              │
│  STAGE 1 — VISION (parallel tasks):                         │
│    ├─ OCR: Extract on-screen text (titles, subtitles)        │
│    ├─ Logo: Detect streaming service logos (Netflix, HBO...) │
│    ├─ Scene: Classify scene type (movie/TV/documentary)      │
│    └─ Hash: Perceptual hash for dedup / frame stability      │
│                                                              │
│  STAGE 2 — SEARCH (uses Vision output):                     │
│    ├─ Build search query from extracted text/metadata        │
│    ├─ Query TMDb text search API                             │
│    ├─ Cross-reference with OMDB by IMDb ID                   │
│    ├─ Fuzzy-match title candidates                           │
│    └─ Output: ContentMatch { title, year, tmdb_id, conf% }  │
│                                                              │
│  STAGE 3 — REVIEW (parallel, uses ContentMatch):            │
│    ├─ OMDB: IMDb rating, RT score, Metacritic                │
│    ├─ TMDb: Audience vote average                            │
│    ├─ Claude: Synthesize Reddit + Letterboxd via web search  │
│    └─ Output: ReviewBundle[] with raw scores + sentiment     │
│                                                              │
│  STAGE 4 — SCORING (uses ReviewBundle):                     │
│    ├─ Normalize all scores → 1.0–5.0                         │
│    ├─ Detect & remove outliers (Z-score > 2.0)               │
│    ├─ Apply weights: critic 40%, audience 40%, sentiment 20% │
│    └─ Output: FinalScore { score, confidence, verdict }      │
│                                                              │
│  STAGE 5 — EXPLANATION (uses all prior output):             │
│    ├─ Claude LLM synthesizes all data                        │
│    ├─ Generate 3–5 bullet pros/cons                          │
│    ├─ One-sentence verdict summary                           │
│    └─ Output: Explanation { pros[], cons[], summary }        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Diagram

```
Camera Frame
    │
    ▼
[Frame Buffer] ──── debounce(500ms) ──── stable frame detected
    │
    ▼
[POST /scan/frame]
    Body: { frames: [base64, ...], timestamp }
    │
    ├── VisionAgent.run(frames)
    │       └── returns: { ocr_text, detected_title, logos, confidence }
    │
    ├── SearchAgent.run(vision_result)
    │       └── returns: { content_id, title, year, poster_url, genre }
    │
    ├── ReviewAgent.run(content_id)           ← runs parallel
    │       └── returns: { sources: [{ name, score, sentiment }...] }
    │
    ├── ScoringAgent.run(reviews)
    │       └── returns: { score: 4.1, confidence: 87%, verdict: "WATCH" }
    │
    └── ExplanationAgent.run(all_data)
            └── returns: { summary, pros[], cons[], quote }
    │
    ▼
[GET /scan/result/{scan_id}]  (polled via WebSocket or SSE)
    Response: ScanResult { content, score, explanation, sources }
```

---

## 4. Scoring Algorithm

```
┌──────────────────────────────────────────────────────────────┐
│                    HONEST SCORE ENGINE                        │
│                                                              │
│  INPUT: raw scores from N sources                            │
│                                                              │
│  Step 1: Normalize each score to [1.0, 5.0]                  │
│    IMDb (0–10)        → score / 2                            │
│    Rotten Tomatoes %  → (pct / 100) * 4 + 1                 │
│    Metacritic (0–100) → (mc / 100) * 4 + 1                  │
│    Letterboxd (0–5)   → direct                               │
│    TMDb (0–10)        → score / 2                            │
│                                                              │
│  Step 2: Categorize sources                                  │
│    critics   = [Metacritic, RT_critic, RogerEbert...]        │
│    audience  = [IMDb, TMDb_audience, Letterboxd, RT_aud...]  │
│    sentiment = [Reddit_score, Claude_sentiment_score]        │
│                                                              │
│  Step 3: Remove outliers within each category               │
│    μ = mean(scores), σ = std(scores)                         │
│    keep scores where |score - μ| < 2σ                        │
│                                                              │
│  Step 4: Weighted average                                    │
│    final = (avg_critics * 0.40)                              │
│           + (avg_audience * 0.40)                            │
│           + (avg_sentiment * 0.20)                           │
│                                                              │
│  Step 5: Confidence score                                    │
│    confidence = min(N_sources / 10, 1.0)      # coverage    │
│               * (1 - std(all_normalized))     # agreement   │
│               * vision_confidence             # ID quality  │
│                                                              │
│  Step 6: Verdict                                             │
│    ≥ 3.8 → WATCH   (green)                                   │
│    2.5–3.7 → OPTIONAL (yellow)                               │
│    < 2.5 → SKIP   (red)                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Content Recognition Strategy

```
Frame arrives
    │
    ▼
Is frame stable? (perceptual hash diff < threshold)
    │ NO  → buffer more frames, return
    │ YES ▼
OCR pass (Google Vision)
    │
    ├── Subtitle text detected?  ──YES──▶ extract clean title candidate
    │                                      ignore common words
    ├── Title card detected?     ──YES──▶ high-confidence candidate
    │
    └── Logo detected?           ──YES──▶ platform context hint
    │                                      (Netflix Original, HBO Max...)
    ▼
Scene classification (Vision API labels)
    ├── "Movie" / "Film" / "Cinema" labels?
    ├── Aspect ratio analysis (2.39:1 = likely film)
    └── Color grading signature

Query TMDb text search
    ├── Primary: exact title match
    ├── Fallback: fuzzy match (Levenshtein < 3)
    └── Fallback: genre + year + partial title

Confidence < 0.5?  ──YES──▶ return "Unable to identify"
                              with retry suggestions:
                              - "Move camera closer to title"
                              - "Wait for title card"
                              - "Try during a quieter scene"
```

---

## 6. Review Sources & Weights

| Source | Category | Weight | API Method |
|---|---|---|---|
| IMDb | Audience | 12% | OMDB API |
| Rotten Tomatoes (Tomatometer) | Critics | 13% | OMDB API |
| Rotten Tomatoes (Audience) | Audience | 10% | OMDB API |
| Metacritic | Critics | 14% | OMDB API |
| TMDb | Audience | 8% | TMDb API |
| Letterboxd | Audience | 10% | Claude web search |
| Reddit r/movies | Sentiment | 8% | SerpAPI + Claude |
| Reddit r/television | Sentiment | 7% | SerpAPI + Claude |
| Roger Ebert / RogerEbert.com | Critics | 7% | Claude web search |
| Google Knowledge Panel | Mixed | 6% | Google API |
| Rotten Tomatoes Super Reviewer | Critics | 5% | Claude web search |

---

## 7. Privacy Architecture

```
Camera Frame
    │
    ├── Processed entirely in RAM
    ├── NEVER written to disk on device
    ├── NEVER stored on server beyond request lifetime
    ├── Transmitted over HTTPS with TLS 1.3
    └── Server discards frame bytes immediately after Vision API call

User Data:
    ├── Watchlist: stored locally on device (AsyncStorage)
    ├── No account required for core scan feature
    └── Optional account for cross-device sync (future)
```

---

## 8. Performance Budget

| Step | Target Latency | Strategy |
|---|---|---|
| Frame capture | < 100ms | Native camera API |
| Frame stability detection | < 50ms | Perceptual hash (pHash) |
| Vision API (OCR + labels) | < 800ms | Google Vision batch |
| TMDb search | < 300ms | Cached + indexed |
| Review aggregation | < 1500ms | Parallel async calls |
| Scoring + explanation | < 600ms | Claude API + local scoring |
| **Total end-to-end** | **< 3.5s** | All stages overlapping |

---

## 9. Tech Stack Summary

| Layer | Technology | Reason |
|---|---|---|
| Mobile | React Native (Expo SDK 52) | Cross-platform, fast iteration |
| Camera | expo-camera + expo-image-manipulator | Frame extraction, resizing |
| Navigation | Expo Router (file-based) | Simple, type-safe routing |
| State | Zustand | Lightweight, no boilerplate |
| Backend | FastAPI (Python 3.12) | Async, fast, excellent AI ecosystem |
| AI Agents | Anthropic Claude claude-sonnet-4-6 | Best reasoning + tool use |
| Vision | Google Cloud Vision API | OCR + label detection |
| Movie Data | TMDb API v3 | Comprehensive, free tier |
| Ratings | OMDB API | IMDb + RT + Metacritic in one call |
| Caching | Redis | Sub-ms repeated lookups |
| Deployment | Railway / Fly.io | Simple container deploy |
