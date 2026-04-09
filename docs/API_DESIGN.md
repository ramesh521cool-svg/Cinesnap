# CineSnap — API Design

## Base URL
```
https://api.cinesnap.app/v1
```

---

## Endpoints

### POST `/scan/frame`
Submit camera frames for content identification.

**Request:**
```json
{
  "frames": ["<base64_jpeg>", "<base64_jpeg>"],
  "device_id": "anon-uuid-v4",
  "timestamp": 1712678400
}
```

**Response (202 Accepted):**
```json
{
  "scan_id": "scan_abc123",
  "status": "processing",
  "estimated_ms": 3500
}
```

---

### GET `/scan/result/{scan_id}`
Poll for scan result.

**Response (200 — complete):**
```json
{
  "scan_id": "scan_abc123",
  "status": "complete",
  "content": {
    "title": "Oppenheimer",
    "year": 2023,
    "type": "movie",
    "genre": ["Biography", "Drama", "History"],
    "poster_url": "https://image.tmdb.org/...",
    "tmdb_id": 872585,
    "imdb_id": "tt15398776",
    "director": "Christopher Nolan",
    "runtime_min": 180,
    "language": "en",
    "match_confidence": 0.94
  },
  "score": {
    "final": 4.3,
    "verdict": "WATCH",
    "confidence": 0.91,
    "breakdown": {
      "critics": 4.5,
      "audience": 4.2,
      "sentiment": 4.1
    }
  },
  "sources": [
    { "name": "IMDb",             "raw": "8.9/10",   "normalized": 4.45, "category": "audience" },
    { "name": "Rotten Tomatoes",  "raw": "93%",      "normalized": 4.72, "category": "critics"  },
    { "name": "Metacritic",       "raw": "88/100",   "normalized": 4.52, "category": "critics"  },
    { "name": "TMDb",             "raw": "8.1/10",   "normalized": 4.05, "category": "audience" },
    { "name": "Letterboxd",       "raw": "4.2/5",    "normalized": 4.20, "category": "audience" },
    { "name": "Reddit r/movies",  "raw": "positive", "normalized": 4.10, "category": "sentiment"}
  ],
  "explanation": {
    "summary": "A visually stunning and intellectually ambitious epic that demands your full attention.",
    "pros": [
      "Cillian Murphy delivers a career-defining performance",
      "Nolan's direction creates unbearable tension throughout",
      "Hans Zimmer score is visceral and haunting",
      "Practical IMAX photography is breathtaking"
    ],
    "cons": [
      "Three-hour runtime may exhaust casual viewers",
      "Non-linear structure can be confusing early on"
    ],
    "notable_quote": "One of the most important films of the decade. — The Guardian"
  },
  "processing_ms": 2847
}
```

**Response (206 — partial, still processing):**
```json
{
  "scan_id": "scan_abc123",
  "status": "processing",
  "stage": "review_aggregation",
  "progress": 0.60
}
```

**Response (200 — unable to identify):**
```json
{
  "scan_id": "scan_abc123",
  "status": "unidentified",
  "reason": "low_confidence",
  "suggestions": [
    "Point camera directly at the screen title card",
    "Wait for subtitles or opening credits",
    "Reduce glare or ambient light",
    "Move closer to the screen"
  ],
  "partial_match": {
    "title_candidate": "Oppenh...",
    "confidence": 0.32
  }
}
```

---

### POST `/watchlist`
Save content to user's watchlist.

**Request:**
```json
{
  "device_id": "anon-uuid-v4",
  "tmdb_id": 872585,
  "action": "add"
}
```

**Response:**
```json
{ "success": true, "watchlist_count": 12 }
```

---

### GET `/watchlist/{device_id}`
Retrieve user's saved watchlist.

**Response:**
```json
{
  "items": [
    {
      "tmdb_id": 872585,
      "title": "Oppenheimer",
      "poster_url": "...",
      "score": 4.3,
      "verdict": "WATCH",
      "added_at": "2024-04-09T10:00:00Z"
    }
  ]
}
```

---

### WebSocket `/scan/stream/{scan_id}`
Real-time progress stream for scan pipeline.

**Server events:**
```
event: stage_update
data: {"stage": "vision", "status": "complete", "result": {...}}

event: stage_update
data: {"stage": "search", "status": "complete", "result": {...}}

event: stage_update
data: {"stage": "reviews", "status": "complete", "result": {...}}

event: stage_update
data: {"stage": "scoring", "status": "complete", "result": {...}}

event: complete
data: {"scan_id": "scan_abc123", "redirect": "/scan/result/scan_abc123"}
```

---

## Error Responses

```json
{
  "error": {
    "code": "FRAME_TOO_BLURRY",
    "message": "Submitted frames are below minimum sharpness threshold.",
    "suggestions": ["Hold the camera steady", "Ensure adequate lighting"]
  }
}
```

**Error codes:**

| Code | HTTP | Meaning |
|---|---|---|
| `FRAME_TOO_BLURRY` | 422 | Laplacian variance < 100 |
| `FRAME_TOO_DARK` | 422 | Mean brightness < 30 |
| `NO_SCREEN_DETECTED` | 422 | No display detected in frame |
| `RATE_LIMITED` | 429 | >10 scans/min per device |
| `VISION_API_ERROR` | 502 | Google Vision upstream error |
| `CONTENT_NOT_FOUND` | 404 | Match confidence < 0.5 |

---

## Rate Limits

| Tier | Scans/min | Scans/day |
|---|---|---|
| Anonymous | 10 | 50 |
| Registered (free) | 30 | 200 |
| Pro | 120 | Unlimited |
