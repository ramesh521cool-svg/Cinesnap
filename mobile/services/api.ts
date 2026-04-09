/**
 * CineSnap API client
 * Handles frame submission, result polling, and watchlist management.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/v1';
const DEVICE_ID_KEY = 'cinesnap_device_id';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from './storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScanSubmitResponse {
  scan_id: string;
  status: 'processing';
  estimated_ms: number;
}

export interface ScanProgressResponse {
  scan_id: string;
  status: 'processing';
  stage: string;
  progress: number;  // 0.0 – 1.0
}

export interface ContentResult {
  title: string;
  year: number | null;
  type: 'movie' | 'tv_show' | 'documentary';
  genre: string[];
  poster_url: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  director: string | null;
  runtime_min: number | null;
  language: string;
  match_confidence: number;
}

export interface ScoreResult {
  final: number;           // 1.0 – 5.0
  verdict: 'WATCH' | 'SKIP' | 'OPTIONAL';
  confidence: number;      // 0.0 – 1.0
  breakdown: {
    critics: number | null;
    audience: number | null;
    sentiment: number | null;
  };
}

export interface ReviewSourceResult {
  name: string;
  raw: string;
  normalized: number;
  category: 'critics' | 'audience' | 'sentiment';
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  is_outlier: boolean;
}

export interface ExplanationResult {
  summary: string;
  pros: string[];
  cons: string[];
  notable_quote: string | null;
}

export interface ScanCompleteResult {
  scan_id: string;
  status: 'complete';
  content: ContentResult;
  score: ScoreResult;
  sources: ReviewSourceResult[];
  explanation: ExplanationResult;
  processing_ms: number;
}

export interface ScanUnidentifiedResult {
  scan_id: string;
  status: 'unidentified';
  reason: string;
  suggestions: string[];
  partial_match: { title_candidate: string; confidence: number } | null;
}

export type ScanResult = ScanCompleteResult | ScanUnidentifiedResult | ScanProgressResponse;


// ─── Core API functions ───────────────────────────────────────────────────────

/**
 * Submit base64 JPEG frames for content identification.
 */
export async function submitFrames(framesB64: string[]): Promise<ScanSubmitResponse> {
  const deviceId = await getDeviceId();
  const response = await fetch(`${BASE_URL}/scan/frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frames: framesB64,
      device_id: deviceId,
      timestamp: Math.floor(Date.now() / 1000),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new APIError(response.status, err?.error?.message ?? 'Failed to submit frames');
  }

  return response.json();
}

/**
 * Poll for scan result. Returns current status (processing/complete/unidentified).
 */
export async function getScanResult(scanId: string): Promise<ScanResult> {
  const response = await fetch(`${BASE_URL}/scan/result/${scanId}`);

  if (!response.ok) {
    throw new APIError(response.status, 'Failed to fetch scan result');
  }

  return response.json();
}

/**
 * Poll until complete or timeout. Calls onProgress on each update.
 */
export async function pollUntilComplete(
  scanId: string,
  onProgress?: (stage: string, progress: number) => void,
  timeoutMs = 15_000,
): Promise<ScanCompleteResult | ScanUnidentifiedResult> {
  const start = Date.now();
  const POLL_INTERVAL = 400;

  while (Date.now() - start < timeoutMs) {
    const result = await getScanResult(scanId);

    if (result.status === 'processing') {
      onProgress?.(result.stage, result.progress);
      await sleep(POLL_INTERVAL);
      continue;
    }

    return result as ScanCompleteResult | ScanUnidentifiedResult;
  }

  throw new APIError(408, 'Scan timed out. Please try again.');
}


// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function addToWatchlist(tmdbId: number): Promise<void> {
  const deviceId = await getDeviceId();
  await fetch(`${BASE_URL}/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, tmdb_id: tmdbId, action: 'add' }),
  });
}

export async function removeFromWatchlist(tmdbId: number): Promise<void> {
  const deviceId = await getDeviceId();
  await fetch(`${BASE_URL}/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, tmdb_id: tmdbId, action: 'remove' }),
  });
}


// ─── Utilities ────────────────────────────────────────────────────────────────

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
