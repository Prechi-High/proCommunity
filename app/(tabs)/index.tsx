import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Chip, Wordmark } from '@/components/ui';
import { MagnifyingGlass } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { getFeedPosts, getProduct, getProductPosts, getProductThreads } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { useAppStore } from '@/lib/store';

const PLACEHOLDERS = [
  'Is CeraVe Foaming Cleanser worth it?',
  'Does this sunscreen leave a white cast?',
  'What do people say about niacinamide?',
  'Will this moisturiser break me out?',
];

const TICKER = [
  'Someone just opened a case on a popular serum',
  'A verified owner posted week-8 photos',
  'People are asking about white cast right now',
];

/**
 * Home / Search — exact sourced-v1 dig process.
 * Type → suggestions; Enter → results (many) or probe (one). Data is live catalog.
 */
export default function HomeScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const addSearch = useAppStore((s) => s.addSearch);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [tick, setTick] = useState(0);
  const [phIndex, setPhIndex] = useState(0);
  const [phText, setPhText] = useState('');

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % TICKER.length), 4200);
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
  const asked = feedPosts
    .filter((p) => p.type === 'question')
    .slice(0, 3)
    .map((p) => {
      const product = getProduct(p.productId);
      const threads = getProductThreads(p.productId, userThreads, userPosts);
      return { post: p, product, thread: threads[0] };
    });

  const hereNow = 1200 + (feedPosts.length * 17) % 200;
  const has = query.length > 0;
  const showingSugg = debounced.length >= 2;

  const investigate = (productId: string) => {
    addSearch(query || productId);
    router.push(`/probe/${productId}`);
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    addSearch(q);
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
        <LivePill label={`${hereNow.toLocaleString()} people digging right now`} />
      </View>

      <Pressable
        onPress={() => setPhIndex((i) => i + 1)}
        accessibilityRole="button"
        accessibilityLabel="Replay headline"
        style={{ marginTop: 20 }}
      >
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 54,
            lineHeight: 52,
            letterSpacing: -1.8,
            color: colors.bone,
            fontWeight: '500',
          }}
        >
          What’s
        </Text>
        <UnredactPhrase key={phIndex} text="the catch?" delayMs={900} />
      </Pressable>

      <Text
        style={{
          marginTop: 18,
          fontFamily: fonts.regular,
          fontSize: 17,
          lineHeight: 25,
          color: colors.bone2,
          maxWidth: 310,
        }}
      >
        Type any product. We read what real people said about it: the good, the bad, and what brands skip.
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
          accessibilityLabel="Investigate"
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
                  <Text>🧴</Text>
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
        <>
          <Pressable
            onPress={() => {
              const first = digging[0];
              if (first) investigate(first.id);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 6, paddingVertical: 14 }}
          >
            <PulseDot />
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.bone2 }}>
              {TICKER[tick]}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone3 }}>Open</Text>
          </Pressable>

          <View style={{ marginTop: 22 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 25, fontWeight: '500', color: colors.bone }}>
                Digging into right now
              </Text>
            </View>
            <View style={{ marginTop: 8 }}>
              {digging.slice(0, 3).map((product, i) => {
                const n = 60 + ((product.id.charCodeAt(0) + i * 17) % 280);
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
                        width: 40,
                        height: 50,
                        borderRadius: 10,
                        backgroundColor: colors.lac,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text>🧴</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, lineHeight: 20 }}>
                        {product.name}
                      </Text>
                      <Caption>{`Hot topic: ${product.attributeTags[0] ?? product.category}`}</Caption>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <PulseDot />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.sage }}>{n}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: 36 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 25, fontWeight: '500', color: colors.bone }}>
              Being asked right now
            </Text>
            <View style={{ marginTop: 6 }}>
              {(asked.length ? asked : digging.slice(0, 2).map((p) => ({ product: p, post: null, thread: null }))).map(
                (row, i) => {
                  const title =
                    row.post?.body?.slice(0, 72) ??
                    row.thread?.title ??
                    `What do people say about ${row.product?.name}?`;
                  return (
                    <Pressable
                      key={row.post?.id ?? row.product?.id ?? i}
                      onPress={() => row.product && investigate(row.product.id)}
                      style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.line }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.serif,
                          fontSize: 21,
                          lineHeight: 25,
                          letterSpacing: -0.2,
                          color: colors.bone,
                          fontWeight: '500',
                        }}
                      >
                        “{title}
                        {title.length >= 72 ? '…' : ''}”
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        {row.product ? <Pill label={row.product.name.slice(0, 22)} /> : null}
                        {row.post?.isVerifiedOwner ? <Pill label="✓ Verified owner" tone="sage" /> : null}
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>

          <View
            style={{
              marginTop: 26,
              backgroundColor: colors.lac,
              borderRadius: 26,
              padding: 22,
            }}
          >
            <Text style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: '500', color: colors.bone }}>
              Got a worry about something?
            </Text>
            <Caption color={colors.bone2}>
              Share your fear, or why you want it. People who’ve used it will reply.
            </Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <Chip label="My fear" onPress={() => router.push('/(tabs)/search')} />
              <Chip label="Why I want it" onPress={() => router.push('/(tabs)/search')} />
              <Chip label="A question" onPress={() => router.push('/(tabs)/search')} />
            </View>
          </View>

          <Text
            style={{
              marginTop: 26,
              fontFamily: fonts.regular,
              fontSize: 12.5,
              lineHeight: 19,
              color: colors.bone3,
            }}
          >
            Starting with skincare and cosmetics. No account needed to search. Nothing paid for. Nothing removed.
          </Text>
        </>
      )}
    </Screen>
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Black redact peel — matches HTML `.rd` / `unredact` on the home hero. */
function UnredactPhrase({ text, delayMs = 900 }: { text: string; delayMs?: number }) {
  const peel = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    peel.setValue(1);
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
          fontSize: 54,
          lineHeight: 52,
          letterSpacing: -1.8,
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
      <PulseDot />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.bone2 }}>{label}</Text>
    </View>
  );
}

function PulseDot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />;
}

function Pill({ label, tone }: { label: string; tone?: 'sage' }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderWidth: tone === 'sage' ? 0 : 1,
        borderColor: colors.line,
        backgroundColor: tone === 'sage' ? colors.sageSoft : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 12,
          color: tone === 'sage' ? colors.sage : colors.bone2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
