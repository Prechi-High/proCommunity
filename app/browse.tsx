import { createElement } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Caption, Notice } from '@/components/ui';
import { ArrowLeft, ArrowSquareOut, Handbag, Lock } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';

/**
 * 09c — the store, seen from inside Sourced.
 *
 * The risk at this boundary is the abrupt tonal drop from a trusted space into
 * an unfamiliar one. So the frame stays ours: same shell colour, a calm host
 * label, and a quiet line confirming the Satchel is still here. The floating
 * widget persists but its nudge is suppressed on this route — reassurance, not
 * interruption, and nothing that competes with completing a purchase.
 */
export default function BrowseScreen() {
  const router = useRouter();
  const { url: rawUrl, host: rawHost } = useLocalSearchParams<{ url?: string; host?: string }>();
  const url = routeId(rawUrl);
  const host = routeId(rawHost) || (url ? hostFrom(url) : 'store');
  const satchelCount = useAppStore((state) => state.satchelItems.length);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.shell }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.mist,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.shell,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back to Sourced">
          <ArrowLeft size={18} color={colors.ink} weight="bold" />
        </Pressable>
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Lock size={11} color={colors.inkSoft} weight="fill" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink }}>{host}</Text>
          </View>
          <Caption>Someone else's store, opened inside Sourced</Caption>
        </View>
        {url ? (
          <Pressable
            onPress={() => Linking.openURL(url)}
            hitSlop={10}
            accessibilityLabel="Open in your browser"
          >
            <ArrowSquareOut size={17} color={colors.rosewood} weight="regular" />
          </Pressable>
        ) : null}
      </View>

      {/* Continuity line: the one thing worth saying at this boundary. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: colors.rosewoodSoft,
        }}
      >
        <Handbag size={13} color={colors.rosewood} weight="fill" />
        <Caption color={colors.rosewood}>
          {satchelCount
            ? `Your Satchel (${satchelCount}) is still here. Come back whenever you're done.`
            : "Your Satchel is still here. Come back whenever you're done."}
        </Caption>
      </View>

      {url && Platform.OS === 'web' ? (
        createElement('iframe', {
          src: url,
          style: { flex: 1, width: '100%', height: '100%', border: 'none', background: '#fff' },
        })
      ) : (
        <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: colors.shell }}>
          <Notice>
            On this device the store opens in your own browser rather than inside Sourced. Your Satchel
            stays exactly as you left it — check things off when you come back.
          </Notice>
          {url ? (
            <Button label="Open the store" icon={ArrowSquareOut} onPress={() => Linking.openURL(url)} />
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function hostFrom(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'store';
  }
}
