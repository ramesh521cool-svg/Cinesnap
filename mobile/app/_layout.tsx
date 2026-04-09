import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="result/[id]"
          options={{
            title: 'Full Review',
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.bgCard },
          }}
        />
      </Stack>
    </>
  );
}
