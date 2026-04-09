/**
 * ReviewBreakdown — displays the list of review sources with
 * their normalized scores and outlier flags.
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import type { ReviewSourceResult } from '../services/api';

interface Props {
  sources: ReviewSourceResult[];
}

const CATEGORY_COLORS = {
  critics:   Colors.primary,
  audience:  Colors.watch,
  sentiment: Colors.optional,
};

const CATEGORY_LABELS = {
  critics:   'Critics',
  audience:  'Audience',
  sentiment: 'Sentiment',
};

function ScoreBar({ value }: { value: number }) {
  const pct = ((value - 1) / 4) * 100;
  const color = value >= 3.8 ? Colors.watch : value >= 2.5 ? Colors.optional : Colors.skip;

  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export function ReviewBreakdown({ sources }: Props) {
  const activeSources = sources.filter(s => !s.is_outlier);
  const outliers = sources.filter(s => s.is_outlier);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Review Sources</Text>

      {activeSources.map(source => (
        <View key={source.name} style={styles.row}>
          <View style={styles.meta}>
            <Text style={styles.sourceName}>{source.name}</Text>
            <View style={[
              styles.categoryPill,
              { backgroundColor: CATEGORY_COLORS[source.category] + '22' }
            ]}>
              <Text style={[styles.categoryLabel, { color: CATEGORY_COLORS[source.category] }]}>
                {CATEGORY_LABELS[source.category]}
              </Text>
            </View>
          </View>
          <View style={styles.scoreCol}>
            <ScoreBar value={source.normalized} />
            <Text style={styles.rawScore}>{source.raw}</Text>
          </View>
        </View>
      ))}

      {outliers.length > 0 && (
        <View style={styles.outlierSection}>
          <Text style={styles.outlierHeading}>Removed as outliers ({outliers.length})</Text>
          {outliers.map(s => (
            <Text key={s.name} style={styles.outlierItem}>
              {s.name}: {s.raw}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  heading: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  row: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  categoryLabel: {
    ...Typography.label,
    fontSize: 10,
  },
  scoreCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  rawScore: {
    ...Typography.small,
    color: Colors.textSecondary,
    minWidth: 52,
    textAlign: 'right',
  },
  outlierSection: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.6,
  },
  outlierHeading: {
    ...Typography.small,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  outlierItem: {
    ...Typography.small,
    color: Colors.textMuted,
  },
});
