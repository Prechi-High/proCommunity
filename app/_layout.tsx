import 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SatchelLayer } from '@/components/SatchelWidget';
import { WebShell } from '@/components/Screen';
import { colors } from '@/constants/theme';
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
  const profile = useAppStore((state) => state.profile);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';

    // HTML V1: search needs no account. Auth is a sheet for save/post/fit — not a gate.
    if (profile?.onboardingComplete && inAuth) {
      router.replace('/(tabs)');
    }
    if (!profile && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [hydrated, profile, segments, router]);

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
    'Boska-Medium': require('../assets/fonts/Boska-Medium.ttf'),
    'Boska-Bold': require('../assets/fonts/Boska-Bold.ttf'),
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
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="results" />
                <Stack.Screen name="probe/[id]" options={{ animation: 'fade' }} />
                <Stack.Screen name="product" />
                <Stack.Screen name="routine/index" />
                <Stack.Screen name="user/[id]" />
                <Stack.Screen name="admin/index" />
                <Stack.Screen name="satchel" />
                <Stack.Screen name="browse" />
                <Stack.Screen name="feed" />
              </Stack>
              <SatchelLayer />
              </View>
            </AuthGate>
          </WebShell>
        </ObservabilityProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
