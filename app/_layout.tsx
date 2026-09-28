import 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { WebShell } from '@/components/Screen';
import { colors } from '@/constants/theme';
import { startAuth } from '@/lib/auth';
import { ObservabilityProvider, wrapRoot } from '@/lib/observability';
import { useAppStore } from '@/lib/store';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: ReactNode }) {
  const hydrated = useAppStore((state) => state.hydrated);

  // Search never needs an account; signing in (email code) unlocks community, saves sync, research and WhatsApp.
  useEffect(() => {
    if (!hydrated) return;
    return startAuth();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.wine }}>
        <ActivityIndicator color={colors.hi} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayout() {
  const [loaded, error] = useFonts({
    'GeneralSans-Regular': require('../assets/fonts/GeneralSans-Regular.ttf'),
    'GeneralSans-Medium': require('../assets/fonts/GeneralSans-Medium.ttf'),
    'GeneralSans-Semibold': require('../assets/fonts/GeneralSans-Semibold.ttf'),
    'GeneralSans-Bold': require('../assets/fonts/GeneralSans-Bold.ttf'),
  });
  const setHydrated = useAppStore((state) => state.setHydrated);
  const persistHydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!useAppStore.getState().hydrated) setHydrated();
    }, 800);
    return () => clearTimeout(timeout);
  }, [setHydrated, persistHydrated]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ObservabilityProvider>
          <WebShell>
            <AuthGate>
              <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.wine },
                  animation: 'fade',
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="results" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="product" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="thread/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="compare" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="room/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="research/index" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="research/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="settings/whatsapp" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="admin/index" />
              </Stack>
              </View>
            </AuthGate>
          </WebShell>
        </ObservabilityProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
