import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

type Verdict = 'WATCH' | 'SKIP' | 'OPTIONAL';

interface Props {
  verdict: Verdict;
  large?: boolean;
}

const CONFIG: Record<Verdict, { label: string; icon: string; color: string }> = {
  WATCH:    { label: 'WATCH',    icon: '✓',  color: Colors.watch },
  SKIP:     { label: 'SKIP',     icon: '✕',  color: Colors.skip },
  OPTIONAL: { label: 'OPTIONAL', icon: '◎',  color: Colors.optional },
};

export function VerdictBadge({ verdict, large = false }: Props) {
  const { label, icon, color } = CONFIG[verdict];

  return (
    <View style={[
      styles.badge,
      { borderColor: color, backgroundColor: color + '22' },
      large && styles.badgeLarge,
    ]}>
      <Text style={[styles.icon, { color }, large && styles.iconLarge]}>{icon}</Text>
      <Text style={[styles.label, { color }, large && styles.labelLarge]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  badgeLarge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  icon: {
    ...Typography.label,
    fontSize: 12,
  },
  iconLarge: {
    fontSize: 16,
  },
  label: {
    ...Typography.label,
    fontSize: 11,
  },
  labelLarge: {
    fontSize: 15,
    fontWeight: '700',
  },
});
