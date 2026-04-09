/**
 * Local storage utilities — watchlist persistence and device ID.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import type { ScanCompleteResult } from './api';

const KEYS = {
  DEVICE_ID:  'cinesnap:device_id',
  WATCHLIST:  'cinesnap:watchlist',
  SCAN_CACHE: 'cinesnap:scan_cache',
} as const;

export interface WatchlistItem {
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  score: number;
  verdict: 'WATCH' | 'SKIP' | 'OPTIONAL';
  added_at: string;  // ISO date
}


// ─── Device ID ────────────────────────────────────────────────────────────────

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEYS.DEVICE_ID);
  if (!id) {
    id = randomUUID();
    await AsyncStorage.setItem(KEYS.DEVICE_ID, id);
  }
  return id;
}


// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.WATCHLIST);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WatchlistItem[];
  } catch {
    return [];
  }
}

export async function addToWatchlist(result: ScanCompleteResult): Promise<void> {
  const list = await getWatchlist();
  const already = list.find(i => i.tmdb_id === result.content.tmdb_id);
  if (already) return;

  const item: WatchlistItem = {
    tmdb_id:    result.content.tmdb_id!,
    title:      result.content.title,
    poster_url: result.content.poster_url,
    score:      result.score.final,
    verdict:    result.score.verdict,
    added_at:   new Date().toISOString(),
  };

  list.unshift(item);  // newest first
  await AsyncStorage.setItem(KEYS.WATCHLIST, JSON.stringify(list));
}

export async function removeFromWatchlist(tmdbId: number): Promise<void> {
  const list = await getWatchlist();
  const filtered = list.filter(i => i.tmdb_id !== tmdbId);
  await AsyncStorage.setItem(KEYS.WATCHLIST, JSON.stringify(filtered));
}

export async function isInWatchlist(tmdbId: number): Promise<boolean> {
  const list = await getWatchlist();
  return list.some(i => i.tmdb_id === tmdbId);
}


// ─── Recent Scan Cache ────────────────────────────────────────────────────────

export async function cacheScanResult(result: ScanCompleteResult): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_CACHE);
  const cache: ScanCompleteResult[] = raw ? JSON.parse(raw) : [];
  // Keep last 20 scans, newest first
  const updated = [result, ...cache.filter(r => r.scan_id !== result.scan_id)].slice(0, 20);
  await AsyncStorage.setItem(KEYS.SCAN_CACHE, JSON.stringify(updated));
}

export async function getRecentScans(): Promise<ScanCompleteResult[]> {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_CACHE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ScanCompleteResult[];
  } catch {
    return [];
  }
}
