import { useState, useEffect, useCallback } from 'react';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  WatchlistItem,
} from '../services/storage';
import type { ScanCompleteResult } from '../services/api';

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getWatchlist();
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (result: ScanCompleteResult) => {
    await addToWatchlist(result);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (tmdbId: number) => {
    await removeFromWatchlist(tmdbId);
    await refresh();
  }, [refresh]);

  const checkInList = useCallback(async (tmdbId: number): Promise<boolean> => {
    return isInWatchlist(tmdbId);
  }, []);

  return { items, loading, add, remove, checkInList, refresh };
}
