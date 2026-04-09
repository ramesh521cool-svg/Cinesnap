/**
 * Scanner Screen — the main "point camera at screen" interface.
 *
 * UI States:
 *  idle        → camera preview + large scan button
 *  capturing   → brief "capturing" flash overlay
 *  processing  → animated progress bar + stage label
 *  complete    → result card slides up (sheet)
 *  unidentified → error card with suggestions
 *  error       → retry prompt
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  SafeAreaView, ScrollView, Share, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { useContentScan } from '../../hooks/useContentScan';
import { useWatchlist } from '../../hooks/useWatchlist';
import { ResultCard } from '../../components/ResultCard';
import { VerdictBadge } from '../../components/VerdictBadge';

const { height: SCREEN_H } = Dimensions.get('window');

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { cameraRef, state, scan, reset } = useContentScan();
  const { add: addToWatchlist, checkInList } = useWatchlist();
  const [inWatchlist, setInWatchlist] = useState(false);
  const router = useRouter();

  // Check watchlist state when result arrives
  useEffect(() => {
    if (state.result?.content.tmdb_id) {
      checkInList(state.result.content.tmdb_id).then(setInWatchlist);
    }
  }, [state.result]);

  if (!permission) return <View style={styles.bg} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionEmoji}>📷</Text>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          CineSnap needs camera access to identify what's playing on your screen.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isActive = state.phase === 'idle' || state.phase === 'capturing';

  return (
    <View style={styles.bg}>
      {/* ── Camera Preview ── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* ── Dark vignette overlay ── */}
      <View style={styles.vignette} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>

        {/* ── Top header ── */}
        {isActive && (
          <View style={styles.topHeader}>
            <Text style={styles.appName}>CineSnap</Text>
            <Text style={styles.appTagline}>Point at any screen</Text>
          </View>
        )}

        {/* ── Processing state ── */}
        {(state.phase === 'processing') && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingCard}>
              <Text style={styles.processingLabel}>{state.stage}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${state.progress * 100}%` as any }]} />
              </View>
              <Text style={styles.processingPercent}>{Math.round(state.progress * 100)}%</Text>
            </View>
          </View>
        )}

        {/* ── Result sheet (slides from bottom) ── */}
        {state.phase === 'complete' && state.result && (
          <View style={styles.resultSheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <ResultCard
                result={state.result}
                inWatchlist={inWatchlist}
                onSave={async () => {
                  if (state.result) {
                    await addToWatchlist(state.result);
                    setInWatchlist(true);
                  }
                }}
                onShare={() => {
                  if (state.result) {
                    const { title, year } = state.result.content;
                    const { final, verdict } = state.result.score;
                    Share.share({
                      message: `${title} (${year}) — ${final}/5 · ${verdict}\nvia CineSnap`,
                    });
                  }
                }}
              />

              {/* Explanation summary */}
              {state.result.explanation && (
                <View style={styles.explanationSection}>
                  <Text style={styles.explanationSummary}>
                    {state.result.explanation.summary}
                  </Text>

                  <View style={styles.proscons}>
                    <View style={styles.prosCol}>
                      <Text style={styles.prosConsHeading}>Pros</Text>
                      {state.result.explanation.pros.map((p, i) => (
                        <Text key={i} style={[styles.bullet, styles.pro]}>• {p}</Text>
                      ))}
                    </View>
                    <View style={styles.consCol}>
                      <Text style={styles.prosConsHeading}>Cons</Text>
                      {state.result.explanation.cons.map((c, i) => (
                        <Text key={i} style={[styles.bullet, styles.con]}>• {c}</Text>
                      ))}
                    </View>
                  </View>

                  {state.result.explanation.notable_quote && (
                    <Text style={styles.quote}>
                      "{state.result.explanation.notable_quote}"
                    </Text>
                  )}

                  {/* Full review details link */}
                  <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => router.push(`/result/${state.result!.scan_id}`)}
                  >
                    <Text style={styles.detailsBtnText}>View All Sources →</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
                <Text style={styles.scanAgainText}>Scan Again</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* ── Unidentified state ── */}
        {state.phase === 'unidentified' && state.unidentified && (
          <View style={styles.resultSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.unidentifiedCard}>
              <Text style={styles.unidentifiedEmoji}>🤔</Text>
              <Text style={styles.unidentifiedTitle}>Couldn't identify the content</Text>
              <Text style={styles.unidentifiedBody}>
                {state.unidentified.partial_match?.title_candidate
                  ? `Partial match: "${state.unidentified.partial_match.title_candidate}"`
                  : 'No match found.'}
              </Text>

              <View style={styles.suggestionList}>
                {state.unidentified.suggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionRow}>
                    <Text style={styles.suggestionBullet}>›</Text>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
                <Text style={styles.scanAgainText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Error state ── */}
        {state.phase === 'error' && (
          <View style={styles.resultSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.unidentifiedCard}>
              <Text style={styles.unidentifiedEmoji}>⚠️</Text>
              <Text style={styles.unidentifiedTitle}>Something went wrong</Text>
              <Text style={styles.unidentifiedBody}>{state.error}</Text>
              <TouchableOpacity style={styles.scanAgainBtn} onPress={reset}>
                <Text style={styles.scanAgainText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Scan button (only in idle state) ── */}
        {isActive && (
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[styles.scanBtn, state.phase === 'capturing' && styles.scanBtnActive]}
              onPress={scan}
              activeOpacity={0.85}
              disabled={state.phase === 'capturing'}
            >
              <View style={styles.scanBtnInner} />
            </TouchableOpacity>
            <Text style={styles.scanHint}>Tap to identify</Text>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated vignette — in production use a gradient image
    borderWidth: 40,
    borderColor: 'rgba(0,0,0,0.5)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // Header
  topHeader: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  appName: {
    ...Typography.h2,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
  },
  appTagline: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  // Processing
  processingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingCard: {
    backgroundColor: 'rgba(15,15,20,0.92)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: 260,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  processingLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  processingPercent: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  // Result sheet
  resultSheet: {
    flex: 1,
    marginTop: 80,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  explanationSection: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  explanationSummary: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  proscons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  prosCol: { flex: 1, gap: 4 },
  consCol: { flex: 1, gap: 4 },
  prosConsHeading: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  bullet: {
    ...Typography.small,
    lineHeight: 20,
  },
  pro: { color: Colors.watch },
  con: { color: Colors.skip },
  quote: {
    ...Typography.small,
    color: Colors.textMuted,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
    paddingLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  detailsBtn: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },
  detailsBtnText: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '600',
  },
  // Unidentified
  unidentifiedCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  unidentifiedEmoji: { fontSize: 48, marginBottom: Spacing.xs },
  unidentifiedTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  unidentifiedBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  suggestionList: { gap: 6, width: '100%', marginTop: Spacing.sm },
  suggestionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  suggestionBullet: { color: Colors.primary, fontSize: 16, lineHeight: 20 },
  suggestionText: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  // Scan again
  scanAgainBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  scanAgainText: { ...Typography.body, color: '#fff', fontWeight: '700' },
  // Bottom controls
  bottomControls: {
    alignItems: 'center',
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  scanBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scanBtnInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  scanHint: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.6)',
  },
  // Permission
  permissionScreen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionEmoji: { fontSize: 64 },
  permissionTitle: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  permissionBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  permissionBtnText: { ...Typography.body, color: '#fff', fontWeight: '700' },
});
