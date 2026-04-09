import { Tabs } from 'expo-router';
import { Colors } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📷" color={color} size={size} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="🎬" color={color} size={size} />
          ),
          headerTitle: 'My Watchlist',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="⚙️" color={color} size={size} />
          ),
          headerTitle: 'Settings',
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color, size }: { emoji: string; color: string; size: number }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: size * 0.85 }}>{emoji}</Text>;
}
