import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import { HapticPressable } from '@/components/HapticPressable';
import { Screen } from '@/components/Screen';
import { Caption, Wordmark } from '@/components/ui';
import { Camera, MagnifyingGlass, categoryIcon } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { getFeedPosts, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { hapticHeavy, hapticPeel, hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { searchCatalog } from '@/lib/products';
import { extractProductFromPhoto } from '@/lib/productVision';
import { playPeelSound, unlockAudio } from '@/lib/sounds';
import { useAppStore } from '@/lib/store';

const PLACEHOLDERS = [
  'What are you thinking about?',
  'Is CeraVe Foaming Cleanser worth it?',
  'Does this sunscreen leave a white cast?',
  'What do people say about niacinamide?',
];

const FOR_LINES = [
  'For people who read the comments first.',
  'For anyone who’s been burned before.',
  'For the ones about to add to cart.',
];

const TICKER = [
  'Someone just opened a case on a popular serum',
  'A verified owner posted week-8 photos',
  'People are asking about white cast right now',
];

/**
 * Home — V2: hero2, forline, big search, ticker, digging chips.
 */
export default function HomeScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [forIndex, setForIndex] = useState(0);
  const [forOut, setForOut] = useState(false);
  const [tickIndex, setTickIndex] = useState(0);
  const [tickOut, setTickOut] = useState(false);
  const [heroKey, setHeroKey] = useState(0);
  const [phText, setPhText] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const barsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setForOut(true);
      setTimeout(() => {
        setForIndex((i) => (i + 1) % FOR_LINES.length);
        setForOut(false);
      }, 350);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTickOut(true);
      setTimeout(() => {
        setTickIndex((i) => (i + 1) % (TICKER.length + 1));
        setTickOut(false);
      }, 300);
    }, 4800);
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

  useEffect(() => {
    Animated.timing(barsAnim, {
      toValue: focused ? 1 : 0,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, barsAnim]);

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

  const tickLabel =
    tickIndex === 0
      ? `${samplePresence} people digging right now`
      : TICKER[(tickIndex - 1) % TICKER.length];

  const investigate = (productId: string) => {
    unlockAudio();
    hapticSelect();
    router.push(`/probe/${productId}`);
  };

  const submit = () => {
    unlockAudio();
    const q = query.trim();
    if (!q) {
      hapticHeavy();
      setShake(true);
      setTimeout(() => setShake(false), 350);
      return;
    }
    hapticSelect();
    if (suggestions.length === 1) investigate(suggestions[0].id);
    else router.push({ pathname: '/results', params: { q } } as Href);
  };

  const scan = async (camera: boolean) => {
    setBusy(true);
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Need access', 'Allow camera or photo access so we can identify the product in your photo.');
        return;
      }

      const result = camera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.8,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect: [4, 3],
          });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const extracted = await extractProductFromPhoto(asset);

      if (!extracted) {
        Alert.alert('Couldn’t identify the product', 'Try a clearer image or search by name instead.');
        return;
      }

      setQuery(extracted);
      hapticSuccess();
      router.push({ pathname: '/results', params: { q: extracted } } as Href);
    } catch (error) {
      console.warn('scan failed', error);
      Alert.alert('Scan failed', 'We could not read that product photo. Try a clearer shot or search manually.');
    } finally {
      setBusy(false);
    }
  };

  const barOffsets = [-40, 48, -72, 96, -28, 64];

  return (
    <Screen>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420, overflow: 'hidden' }} pointerEvents="none">
        {barOffsets.map((dx, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: 24,
              top: 40 + i * 52,
              width: '70%',
              height: 15,
              borderRadius: 3,
              backgroundColor: colors.wineDeep,
              opacity: 0.55,
              transform: [
                {
                  translateX: barsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, dx],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <Wordmark />
        <HapticPressable
          onPress={() => router.push(profile ? '/(tabs)/you' : '/(auth)/sign-in')}
          hitSlop={8}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2, paddingVertical: 10 }}>
            {profile?.displayName ? profile.displayName.split(' ')[0] : 'Sign in'}
          </Text>
        </HapticPressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 8 }}>
        <Pressable
          onPress={() => {
            unlockAudio();
            hapticPeel();
            playPeelSound();
            setHeroKey((k) => k + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Replay headline"
          style={{ marginTop: 12 }}
        >
          <Text
            style={{
              fontFamily: fonts.serif,
              fontSize: 62,
              lineHeight: 58,
              letterSpacing: -2.2,
              color: colors.bone,
              fontWeight: '500',
            }}
          >
            Someone’s{'
'}already
          </Text>
          <UnredactPhrase key={heroKey} text="tried it." delayMs={900} />
        </Pressable>

        <Text
          style={{
            marginTop: 16,
            fontFamily: fonts.regular,
            fontSize: 17,
            lineHeight: 24,
            color: colors.bone2,
            opacity: forOut ? 0 : 1,
            transform: [{ translateY: forOut ? -6 : 0 }],
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
            transform: [{ translateX: shake ? 4 : 0 }],
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
          <HapticPressable
            onPress={submit}
            skipHaptic
            style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              backgroundColor: has ? colors.hi : colors.wine,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Find what they said"
          >
            <MagnifyingGlass size={24} color={has ? colors.wine : colors.bone} weight="bold" />
          </HapticPressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <HapticPressable
            onPress={() => scan(false)}
            disabled={busy}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.line,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Camera size={18} color={colors.bone} weight="bold" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>{busy ? 'Scanning…' : 'Upload photo'}</Text>
            </View>
          </HapticPressable>
          <HapticPressable
            onPress={() => scan(true)}
            disabled={busy}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.line,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Camera size={18} color={colors.hi} weight="fill" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>Take photo</Text>
            </View>
          </HapticPressable>
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
                <HapticPressable
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
                </HapticPressable>
              );
            })}
            <HapticPressable
              onPress={submit}
              style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone2 }}>
                {suggestions.length
                  ? `See all results for “${debounced}”`
                  : `Nothing matched. Browse what we cover for “${debounced}”`}
              </Text>
            </HapticPressable>
          </View>
        ) : (
          <>
            <HapticPressable
              onPress={() => {
                const first = digging[0];
                if (first) investigate(first.id);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                marginTop: 6,
                paddingVertical: 14,
              }}
            >
              <PulseDot />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: fonts.regular,
                  fontSize: 14.5,
                  color: colors.bone2,
                  opacity: tickOut ? 0 : 1,
                }}
              >
                {tickLabel}
              </Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone3 }}>Open</Text>
            </HapticPressable>

            <View style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3, marginBottom: 10 }}>
                Digging into right now
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {digging.slice(0, 5).map((product, i) => {
                  const n = 40 + ((product.id.charCodeAt(0) + i * 17) % 120);
                  return (
                    <HapticPressable
                      key={product.id}
                      onPress={() => investigate(product.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 11,
                        paddingHorizontal: 15,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.line,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.bone }}>
                        {product.name.length > 18 ? `${product.name.slice(0, 16)}…` : product.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <PulseDot />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.sage }}>{n}</Text>
                      </View>
                    </HapticPressable>
                  );
                })}
              </ScrollView>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function UnredactPhrase({ text, delayMs = 900 }: { text: string; delayMs?: number }) {
  const peel = useRef(new Animated.Value(1)).current;
  const sounded = useRef(false);

  useEffect(() => {
    peel.setValue(1);
    sounded.current = false;
    const anim = Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(peel, {
        toValue: 0,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const t = setTimeout(() => {
      if (!sounded.current) {
        sounded.current = true;
        hapticPeel();
        playPeelSound();
      }
    }, delayMs);
    anim.start();
    return () => {
      clearTimeout(t);
      anim.stop();
    };
  }, [delayMs, peel, text]);

  return (
    <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: 62,
          lineHeight: 58,
          letterSpacing: -2.2,
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

function PulseDot() {
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage, position: 'relative' }} />
  );
}

