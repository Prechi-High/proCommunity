import { createElement } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, Caption, Notice } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';

export default function BrowseScreen() {
  const router = useRouter();
  const { url: rawUrl, host: rawHost } = useLocalSearchParams<{ url?: string; host?: string }>();
  const url = routeId(rawUrl);
  const host = routeId(rawHost) || (url ? hostFrom(url) : 'store');

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.mist,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.shell,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: colors.ink }}>←</Text>
        </Pressable>
        <Caption>{host}</Caption>
        <View style={{ flex: 1 }} />
        {url ? (
          <Pressable onPress={() => Linking.openURL(url)}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.rosewood }}>Open</Text>
          </Pressable>
        ) : null}
      </View>
      {url && Platform.OS === 'web' ? (
        createElement('iframe', {
          src: url,
          style: { flex: 1, width: '100%', height: '100%', border: 'none', background: '#fff' },
        })
      ) : (
        <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: colors.shell }}>
          <Notice>
            This store opens in a browser we do not overlay on this device. Your Satchel stays here — check items off
            when you return. True overlay outside our app is not possible on iOS.
          </Notice>
          {url ? <Button label="Open store" onPress={() => Linking.openURL(url)} /> : null}
        </View>
      )}
    </View>
  );
}

function hostFrom(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'store';
  }
}
