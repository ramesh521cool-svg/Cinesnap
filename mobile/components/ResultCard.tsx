/**
 * ResultCard — the hero card showing content title, poster,
 * score gauge, verdict badge, and quick action buttons.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { ScoreGauge } from './ScoreGauge';
import { VerdictBadge } from './VerdictBadge';
import type { ScanCompleteResult } from '../services/api';

interface Props {
  result: ScanCompleteResult;
  inWatchlist: boolean;
  onSave: () => void;
  onShare: () => void;
}

export function ResultCard({ result, inWatchlist, onSave, onShare }: Props) {
  const { content, score } = result;

  const metaLine = [
    content.year,
    content.genre.slice(0, 2).join(' · '),
    content.runtime_min ? `${content.runtime_min}m` : null,
  ].filter(Boolean).join('  •  ');

  return (
    <View style={styles.card}>
      {/* Poster + Score side-by-side */}
      <View style={styles.topRow}>
        {content.poster_url ? (
          <Image
            source={{ uri: content.poster_url }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Text style={styles.posterPlaceholderText}>🎬</Text>
          </View>
        )}

        <View style={styles.topRight}>
          <ScoreGauge
            score={score.final}
            confidence={score.confidence}
            size={110}
          />
          <View style={{ marginTop: Spacing.sm }}>
            <VerdictBadge verdict={score.verdict} large />
          </View>
        </View>
      </View>

      {/* Title + meta */}
      <View style={styles.titleSection}>
        <Text style={styles.title} numberOfLines={2}>{content.title}</Text>
        {metaLine ? (
          <Text style={styles.meta}>{metaLine}</Text>
        ) : null}
        {content.director ? (
          <Text style={styles.director}>Directed by {content.director}</Text>
        ) : null}
      </View>

      {/* Score breakdown pills */}
      <View style={styles.breakdown}>
        {score.breakdown.critics != null && (
          <ScorePill label="Critics" value={score.breakdown.critics} color={Colors.primary} />
        )}
        {score.breakdown.audience != null && (
          <ScorePill label="Audience" value={score.breakdown.audience} color={Colors.watch} />
        )}
        {score.breakdown.sentiment != null && (
          <ScorePill label="Sentiment" value={score.breakdown.sentiment} color={Colors.optional} />
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, inWatchlist ? styles.btnActive : styles.btnOutline]}
          onPress={onSave}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, inWatchlist && styles.btnTextActive]}>
            {inWatchlist ? '✓ Saved' : '+ Watchlist'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={onShare} activeOpacity={0.8}>
          <Text style={styles.btnText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + '44' }]}>
      <Text style={[styles.pillLabel, { color: Colors.textMuted }]}>{label}</Text>
      <Text style={[styles.pillValue, { color }]}>{value.toFixed(1)}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  poster: {
    width: 100,
    height: 148,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderText: {
    fontSize: 36,
  },
  topRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xs,
  },
  titleSection: {
    gap: 4,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  meta: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  director: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  breakdown: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    flex: 1,
    minWidth: 80,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  pillLabel: {
    ...Typography.label,
    fontSize: 10,
  },
  pillValue: {
    ...Typography.h3,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  btnActive: {
    backgroundColor: Colors.primary,
  },
  btnText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  btnTextActive: {
    color: '#fff',
  },
});
