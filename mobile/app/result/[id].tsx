/**
 * Full Result Detail Screen — shows all review sources, breakdown,
 * and explanation for a previously completed scan.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { ReviewBreakdown } from '../../components/ReviewBreakdown';
import { ScoreGauge } from '../../components/ScoreGauge';
import { VerdictBadge } from '../../components/VerdictBadge';
import { getScanResult } from '../../services/api';
import type { ScanCompleteResult } from '../../services/api';

export default function ResultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<ScanCompleteResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getScanResult(id).then(r => {
      if (r.status === 'complete') setResult(r as ScanCompleteResult);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Result not available.</Text>
      </View>
    );
  }

  const { content, score, sources, explanation } = result;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Score header */}
      <View style={styles.scoreHeader}>
        <ScoreGauge score={score.final} confidence={score.confidence} size={130} />
        <View style={styles.scoreHeaderMeta}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.year}>{content.year ?? ''} · {content.genre.slice(0, 2).join(', ')}</Text>
          <VerdictBadge verdict={score.verdict} large />
        </View>
      </View>

      {/* Explanation */}
      {explanation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Verdict</Text>
          <Text style={styles.summary}>{explanation.summary}</Text>

          {explanation.notable_quote && (
            <Text style={styles.quote}>"{explanation.notable_quote}"</Text>
          )}

          <View style={styles.proscons}>
            <View style={styles.column}>
              <Text style={[styles.columnTitle, { color: Colors.watch }]}>What works</Text>
              {explanation.pros.map((p, i) => (
                <Text key={i} style={[styles.bullet, { color: Colors.watch }]}>✓ {p}</Text>
              ))}
            </View>
            <View style={styles.column}>
              <Text style={[styles.columnTitle, { color: Colors.skip }]}>What doesn't</Text>
              {explanation.cons.map((c, i) => (
                <Text key={i} style={[styles.bullet, { color: Colors.skip }]}>✕ {c}</Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Score breakdown */}
      <View style={styles.section}>
        <View style={styles.weightRow}>
          <WeightBadge label="Critics" pct="40%" color={Colors.primary} score={score.breakdown.critics} />
          <WeightBadge label="Audience" pct="40%" color={Colors.watch} score={score.breakdown.audience} />
          <WeightBadge label="Sentiment" pct="20%" color={Colors.optional} score={score.breakdown.sentiment} />
        </View>
      </View>

      {/* All sources */}
      <View style={styles.section}>
        <ReviewBreakdown sources={sources as any} />
      </View>

      <Text style={styles.processingNote}>
        Processed in {result.processing_ms}ms · {sources.filter((s: any) => !s.is_outlier).length} sources
      </Text>
    </ScrollView>
  );
}

function WeightBadge({ label, pct, color, score }: {
  label: string; pct: string; color: string; score: number | null | undefined;
}) {
  return (
    <View style={[styles.weightBadge, { borderColor: color + '44' }]}>
      <Text style={[styles.weightLabel, { color: Colors.textMuted }]}>{label}</Text>
      <Text style={[styles.weightScore, { color }]}>{score?.toFixed(1) ?? '—'}</Text>
      <Text style={[styles.weightPct, { color: Colors.textMuted }]}>{pct} weight</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  errorText: { ...Typography.body, color: Colors.textSecondary },
  scoreHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreHeaderMeta: { flex: 1, gap: Spacing.sm },
  title: { ...Typography.h2, color: Colors.textPrimary },
  year: { ...Typography.small, color: Colors.textSecondary },
  section: {
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { ...Typography.h3, color: Colors.textPrimary },
  summary: { ...Typography.body, color: Colors.textSecondary, lineHeight: 24, fontStyle: 'italic' },
  quote: {
    ...Typography.small,
    color: Colors.textMuted,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
    paddingLeft: Spacing.sm,
  },
  proscons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  column: { flex: 1, gap: 6 },
  columnTitle: { ...Typography.label, marginBottom: 2 },
  bullet: { ...Typography.small, lineHeight: 20 },
  weightRow: { flexDirection: 'row', gap: Spacing.sm },
  weightBadge: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  weightLabel: { ...Typography.label, fontSize: 10 },
  weightScore: { ...Typography.h3, fontWeight: '700' },
  weightPct: { ...Typography.label, fontSize: 9 },
  processingNote: {
    ...Typography.small,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
