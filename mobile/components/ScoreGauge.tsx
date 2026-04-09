/**
 * ScoreGauge — animated circular score display.
 * Shows the 1–5 score with a color-coded arc and confidence indicator.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography } from '../constants/theme';

interface Props {
  score: number;       // 1.0 – 5.0
  confidence: number;  // 0.0 – 1.0
  size?: number;
}

function scoreColor(score: number): string {
  if (score >= 4.2) return Colors.score5;
  if (score >= 3.5) return Colors.score4;
  if (score >= 2.8) return Colors.score3;
  if (score >= 2.0) return Colors.score2;
  return Colors.score1;
}

export function ScoreGauge({ score, confidence, size = 120 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const color = scoreColor(score);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer ring */}
      <View style={[styles.ring, { borderColor: color + '33', width: size, height: size, borderRadius: size / 2 }]} />
      {/* Colored progress ring approximation using border */}
      <View style={[
        styles.innerRing,
        {
          borderColor: color,
          width: size - 12,
          height: size - 12,
          borderRadius: (size - 12) / 2,
        }
      ]} />
      {/* Center content */}
      <View style={styles.center}>
        <Text style={[styles.score, { color, fontSize: size * 0.28 }]}>
          {score.toFixed(1)}
        </Text>
        <Text style={[styles.outOf, { fontSize: size * 0.11 }]}>/5</Text>
        <Text style={[styles.confidence, { fontSize: size * 0.09 }]}>
          {Math.round(confidence * 100)}% confidence
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 8,
  },
  innerRing: {
    position: 'absolute',
    borderWidth: 4,
    opacity: 0.6,
  },
  center: {
    alignItems: 'center',
  },
  score: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  outOf: {
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: -4,
  },
  confidence: {
    color: Colors.textMuted,
    marginTop: 2,
  },
});
