import 'react-native-gesture-handler';
import { registerRealtimeGlobals } from '@/lib/realtime/registerGlobals';
registerRealtimeGlobals();
import { ContentSkeleton } from '@/components/unmask-ui/Skeleton';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { LogBox, Platform, useColorScheme, View } from 'react-native';
LogBox.ignoreLogs(['Invalid DOM property']);
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { WebShell } from '@/components/Screen';
import { features } from '@/lib/features';
import { applyThemeColors, colors } from '@/constants/theme';
import { startAuth } from '@/lib/auth';
import { recordSiteVisit } from '@/lib/siteAnalytics';
import { ObservabilityProvider, wrapRoot } from '@/lib/observability';
import { useAppStore } from '@/lib/store';
import { kickWebHydration } from '@/lib/webBoot';

const RoomDock = features.audioRooms
  ? require('@/components/room/RoomDock').RoomDock
  : () => null;

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

if (Platform.OS !== 'web') SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: ReactNode }) {
  const hydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    if (Platform.OS === 'web') kickWebHydration();
  }, []);

  // Search never needs an account; signing in (email code) unlocks community, saves sync, research and WhatsApp.
  useEffect(() => {
    if (!hydrated) return;
    const boot = () => {
      void recordSiteVisit('/');
      return startAuth();
    };
    if (Platform.OS === 'web' && typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(boot);
      return () => cancelIdleCallback(id);
    }
    return boot();
  }, [hydrated]);

  if (!hydrated && Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.wine }}>
        <ContentSkeleton rows={4} />
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
  const themeMode = useAppStore((state) => state.themeMode);
  const systemScheme = useColorScheme();
  const systemDark =
    systemScheme === "dark" ||
    (typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  applyThemeColors(themeMode, systemDark);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    const ms = Platform.OS === 'web' ? 50 : 800;
    const timeout = setTimeout(() => {
      if (!useAppStore.getState().hydrated) setHydrated();
    }, ms);
    return () => clearTimeout(timeout);
  }, [setHydrated, persistHydrated]);

  const fontsReady = loaded || Platform.OS === 'web';
  if (!fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 70 }}>
        <ContentSkeleton rows={5} />
      </View>
    );
  }

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
                <Stack.Screen name="welcome" />
                <Stack.Screen name="results" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="product" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="story/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="thread/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="investigation" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="moment" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="contribute" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="ask-community" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="compare" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="room/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="member/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="research/index" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="research/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="settings/whatsapp" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="admin/index" />
              </Stack>
              <RoomDock />
              </View>
            </AuthGate>
          </WebShell>
        </ObservabilityProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
