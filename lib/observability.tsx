import * as Sentry from '@sentry/react-native';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useEffect, type ComponentType, type ReactNode } from 'react';

import { bindAnalytics } from './analytics';
import { useAppStore } from './store';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

try {
  Sentry.init({
    dsn: sentryDsn || undefined,
    enabled: Boolean(sentryDsn),
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
} catch {
  // Native Sentry is unavailable on some web/dev hosts.
}

function AnalyticsBinder({ children }: { children: ReactNode }) {
  const posthog = usePostHog();
  const profile = useAppStore((state) => state.profile);

  useEffect(() => {
    bindAnalytics((event, props) => {
      posthog.capture(event, props as never);
    });
    return () => bindAnalytics(() => undefined);
  }, [posthog]);

  useEffect(() => {
    if (!profile) return;
    posthog.identify(profile.id, {
      email: profile.email,
      display_name: profile.displayName,
    });
    Sentry.setUser({ id: profile.id, username: profile.displayName });
  }, [posthog, profile]);

  return <>{children}</>;
}

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  if (!posthogKey) return <>{children}</>;
  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{ host: posthogHost }}
      autocapture={{
        captureTouches: true,
        captureScreens: false,
      }}
    >
      <AnalyticsBinder>{children}</AnalyticsBinder>
    </PostHogProvider>
  );
}

export function wrapRoot(component: ComponentType) {
  try {
    return Sentry.wrap(component);
  } catch {
    return component;
  }
}
