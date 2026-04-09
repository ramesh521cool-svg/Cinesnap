import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

export default function SettingsScreen() {
  async function clearAllData() {
    Alert.alert(
      'Clear all data',
      'This will remove your watchlist and scan history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Done', 'All local data has been cleared.');
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="About">
        <SettingsRow label="Version" value="1.0.0" />
        <SettingsRow label="How it works" onPress={() => {}} />
        <SettingsRow label="Privacy policy" onPress={() => Linking.openURL('https://cinesnap.app/privacy')} />
      </Section>

      <Section title="Scoring">
        <InfoRow text="Critics weight: 40%" />
        <InfoRow text="Audience weight: 40%" />
        <InfoRow text="Sentiment weight: 20%" />
        <InfoRow text="Outlier removal: Z-score > 2.0" />
      </Section>

      <Section title="Privacy">
        <InfoRow text="Camera frames are never stored on our servers." />
        <InfoRow text="Frames are processed in memory and discarded immediately." />
        <InfoRow text="No account required. Your watchlist is saved locally only." />
      </Section>

      <Section title="Data">
        <SettingsRow
          label="Clear all data"
          labelStyle={{ color: Colors.skip }}
          onPress={clearAllData}
        />
      </Section>

      <Text style={styles.footer}>
        CineSnap — Honest AI movie reviews{'\n'}
        Powered by Claude AI · TMDb · OMDB
      </Text>
    </ScrollView>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label, value, onPress, labelStyle,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  labelStyle?: object;
}) {
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.settingsLabel, labelStyle]}>{label}</Text>
      {value ? (
        <Text style={styles.settingsValue}>{value}</Text>
      ) : onPress ? (
        <Text style={styles.settingsChevron}>›</Text>
      ) : null}
    </Row>
  );
}

function InfoRow({ text }: { text: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoDot}>·</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Colors.textMuted, marginLeft: Spacing.xs },
  sectionContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderFaint,
  },
  settingsLabel: { ...Typography.body, color: Colors.textPrimary },
  settingsValue: { ...Typography.body, color: Colors.textSecondary },
  settingsChevron: { color: Colors.textMuted, fontSize: 20 },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderFaint,
  },
  infoDot: { color: Colors.primary, fontSize: 16 },
  infoText: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  footer: {
    ...Typography.small,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.lg,
  },
});
