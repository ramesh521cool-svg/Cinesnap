import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  Image, StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { VerdictBadge } from '../../components/VerdictBadge';
import { useWatchlist } from '../../hooks/useWatchlist';
import type { WatchlistItem } from '../../services/storage';

export default function WatchlistScreen() {
  const { items, loading, refresh, remove } = useWatchlist();

  // Refresh list when tab gains focus
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (!loading && items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={styles.emptyTitle}>Nothing saved yet</Text>
        <Text style={styles.emptyBody}>
          Scan content you want to remember and save it here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={item => String(item.tmdb_id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
      renderItem={({ item }) => <WatchlistRow item={item} onRemove={() => remove(item.tmdb_id)} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function WatchlistRow({ item, onRemove }: { item: WatchlistItem; onRemove: () => void }) {
  const addedDate = new Date(item.added_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  });

  return (
    <View style={styles.row}>
      {item.poster_url ? (
        <Image source={{ uri: item.poster_url }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text>🎬</Text>
        </View>
      )}

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.score}>{item.score.toFixed(1)}/5</Text>
          <VerdictBadge verdict={item.verdict} />
        </View>
        <Text style={styles.addedDate}>Added {addedDate}</Text>
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: Colors.bg },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  empty: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary },
  emptyBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  separator: { height: Spacing.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  poster: {
    width: 64,
    height: 88,
    backgroundColor: Colors.bgInput,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    padding: Spacing.sm + 2,
    justifyContent: 'center',
    gap: 4,
  },
  rowTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  score: { ...Typography.small, color: Colors.primary, fontWeight: '700' },
  addedDate: { ...Typography.small, color: Colors.textMuted },
  removeBtn: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  removeBtnText: { color: Colors.textMuted, fontSize: 16 },
});
