import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Chip, Wordmark } from '@/components/ui';
import { MagnifyingGlass, categoryIcon } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { getFeedPosts, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { hapticPeel, hapticSignature, hapticTap } from '@/lib/haptics';
import { searchCatalog } from '@/lib/products';
import { useAppStore } from '@/lib/store';

const PLACEHOLDERS = [
  'Is CeraVe Foaming Cleanser worth it?',
  'Does this sunscreen leave a white cast?',
  'What do people say about niacinamide?',
  'Will this moisturiser break me out?',
];

const FOR_LINES = [
  'For people who read the comments first',
  'For people who want the complaints too',
  'For people who check before they buy',
  'For people who trust owners over ads',
];

/**
 * Home — search only. Hero, rotating For…, search, live line, digging chips.
 */
export default function HomeScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [forIndex, setForIndex] = useState(0);
  const [heroKey, setHeroKey] = useState(0);
  const [phText, setPhText] = useState('');

  useEffect(() => {
    const id = setInterval(() => setForIndex((i) => (i + 1) % FOR_LINES.length), 4200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (query || focused) return;
    let cancelled = false;
    let i = 0;
    const run = async () => {
      while (!cancelled) {
        const s = PLACEHOLDERS[i++ % PLACEHOLDERS.length];
        for (let c = 0; c <= s.length; c++) {
          if (cancelled) return;
          setPhText(s.slice(0, c));
          await sleep(40);
        }
        await sleep(1700);
        for (let c = s.length; c >= 0; c--) {
          if (cancelled) return;
          setPhText(s.slice(0, c));
          await sleep(14);
        }
        await sleep(350);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [query, focused]);

  const debounced = useMemo(() => query.trim(), [query]);
  const { data: suggestions = [] } = useQuery({
    queryKey: ['home-suggest', debounced],
    queryFn: () => searchCatalog(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const { data: digging = [] } = useQuery({
    queryKey: ['home-digging'],
    queryFn: () => searchCatalog('serum moisturizer sunscreen cleanser'),
    staleTime: 5 * 60_000,
  });

  const feedPosts = getFeedPosts(undefined, userPosts);
  const samplePresence = 18 + (feedPosts.length % 40);
  const has = query.length > 0;
  const showingSugg = debounced.length >= 2;

  const investigate = (productId: string) => {
    hapticTap();
    router.push(`/probe/${productId}`);
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    hapticSignature();
    if (suggestions.length === 1) investigate(suggestions[0].id);
    else router.push({ pathname: '/results', params: { q } } as Href);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <Wordmark />
        <Pressable
          onPress={() => router.push(profile ? '/(tabs)/you' : '/(auth)/sign-in')}
          hitSlop={8}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2, paddingVertical: 10 }}>
            {profile?.displayName ? profile.displayName.split(' ')[0] : 'Sign in'}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
        <LivePill label={`Sample · ${samplePresence} people reading cases right now`} />
      </View>

      <Pressable
        onPress={() => {
          hapticPeel();
          setHeroKey((k) => k + 1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Replay headline"
        style={{ marginTop: 22 }}
      >
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 46,
            lineHeight: 46,
            letterSpacing: -1.4,
            color: colors.bone,
            fontWeight: '500',
          }}
        >
          Someone’s
        </Text>
        <UnredactPhrase key={heroKey} text="already tried it." delayMs={900} size={46} />
      </Pressable>

      <Text
        style={{
          marginTop: 10,
          fontFamily: fonts.regular,
          fontSize: 14,
          lineHeight: 20,
          color: colors.bone3,
        }}
      >
        Don’t buy blind.
      </Text>

      <Text
        key={forIndex}
        style={{
          marginTop: 14,
          fontFamily: fonts.regular,
          fontSize: 17,
          lineHeight: 24,
          color: colors.bone2,
          maxWidth: 320,
        }}
      >
        {FOR_LINES[forIndex]}
      </Text>

      <View
        style={{
          marginTop: 26,
          height: 78,
          borderRadius: radii.search,
          backgroundColor: colors.bone,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 10,
          borderWidth: focused ? 3 : 0,
          borderColor: 'rgba(242,210,91,0.6)',
        }}
      >
        {!has ? (
          <Text
            pointerEvents="none"
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: 24,
              right: 76,
              fontFamily: fonts.medium,
              fontSize: 18,
              color: 'rgba(42,14,22,0.5)',
            }}
          >
            {phText}
          </Text>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          accessibilityLabel="Search a product"
          style={{
            flex: 1,
            fontFamily: fonts.medium,
            fontSize: 18,
            color: colors.wine,
            height: '100%',
          }}
        />
        <Pressable
          onPress={submit}
          style={{
            width: 56,
            height: 56,
            borderRadius: 20,
            backgroundColor: has ? colors.hi : colors.wine,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel="Source it"
        >
          <MagnifyingGlass size={24} color={has ? colors.wine : colors.bone} weight="bold" />
        </Pressable>
      </View>

      {showingSugg ? (
        <View style={{ marginTop: 8 }}>
          {suggestions.slice(0, 3).map((product) => {
            const score = computeConfidence(
              product,
              profile,
              getProductPosts(product.id, userPosts),
            ).compositeScore;
            const Icon = categoryIcon(product.category);
            return (
              <Pressable
                key={product.id}
                onPress={() => investigate(product.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: colors.lac,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={colors.bone2} weight="regular" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>
                    {product.name}
                  </Text>
                  <Caption>{product.brand}</Caption>
                </View>
                <Text
                  style={{
                    fontFamily: score == null ? fonts.medium : fonts.serif,
                    fontSize: score == null ? 13 : 26,
                    color: score == null ? colors.bone3 : colors.bone,
                    fontWeight: '500',
                  }}
                >
                  {score ?? 'No score'}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={submit}
            style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone2 }}>
              {suggestions.length
                ? `See all results for “${debounced}”`
                : `Nothing matched. Browse what we cover for “${debounced}”`}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 28 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: '500', color: colors.bone }}>
            Digging right now
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingTop: 14, paddingBottom: 8 }}
          >
            {digging.slice(0, 5).map((product) => (
              <Chip
                key={product.id}
                label={product.name.length > 22 ? `${product.name.slice(0, 20)}…` : product.name}
                onPress={() => investigate(product.id)}
              />
            ))}
          </ScrollView>
          <Text
            style={{
              marginTop: 28,
              fontFamily: fonts.regular,
              fontSize: 12.5,
              lineHeight: 19,
              color: colors.bone3,
            }}
          >
            Starting with skincare and cosmetics. No account needed to search. Nothing paid for. Nothing removed.
          </Text>
        </View>
      )}
    </Screen>
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function UnredactPhrase({
  text,
  delayMs = 900,
  size = 54,
}: {
  text: string;
  delayMs?: number;
  size?: number;
}) {
  const peel = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    peel.setValue(1);
    hapticPeel();
    const anim = Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(peel, {
        toValue: 0,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delayMs, peel, text]);

  return (
    <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: size,
          lineHeight: size,
          letterSpacing: -1.4,
          color: colors.bone,
          fontWeight: '500',
        }}
      >
        {text}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          bottom: 2,
          left: -2,
          right: -2,
          backgroundColor: colors.redact,
          borderRadius: 3,
          transform: [{ scaleX: peel }],
          ...(Platform.OS === 'web'
            ? ({ transformOrigin: '100% 50%' } as object)
            : ({ transformOrigin: 'right center' } as object)),
        }}
      />
    </View>
  );
}

function LivePill({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: 'rgba(243,235,226,0.07)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.bone2 }}>{label}</Text>
    </View>
  );
}
