import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { OfficialEmbed } from '@/components/VideoEmbed';
import { ArrowSquareOut, ArrowsLeftRight, CheckCircle, Globe, Play, Storefront, X } from '@/components/icons';
import { Eyebrow, Group, GroupRow, Pill, Shimmer, Stars, Tile } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { formatPrice, formatRange } from '@/lib/products';
import type { ProductProfile } from '@/lib/types';
import { clipLabel, type JourneyClip } from '@/lib/videos';

export async function openLink(url: string | null | undefined) {
  if (!url) return;
  hapticTap();
  if (Platform.OS === 'web') {
    void Linking.openURL(url);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    void Linking.openURL(url);
  }
}

// ---------------------------------------------------------------------------

export function SpecsPane({
  profile,
  onAlternative,
}: {
  profile: ProductProfile;
  onAlternative: (name: string) => void;
}) {
  const id = profile.identity;
  const identityRows = [
    ['Brand', id.brand],
    ['Model', id.model],
    ['Category', [id.category, id.subcategory].filter(Boolean).join(' · ')],
    ['Variant', id.variant],
    ['Size', id.size],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <View style={{ gap: 16 }}>
      {profile.summary ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, color: colors.bone }}>{profile.summary}</Text>
      ) : null}
      {profile.specs.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Key specs</Eyebrow>
          <Group>
            {profile.specs.map((s, i) => (
              <GroupRow key={`${s.label}-${i}`} label={s.label} value={s.value} last={i === profile.specs.length - 1} />
            ))}
          </Group>
        </View>
      ) : null}
      {identityRows.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Identity</Eyebrow>
          <Group>
            {identityRows.map(([l, v], i) => (
              <GroupRow key={l} label={l} value={v} last={i === identityRows.length - 1} />
            ))}
          </Group>
        </View>
      ) : null}
      {profile.howToUse || profile.compatibility || profile.uses.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Using it</Eyebrow>
          <Group style={{ paddingVertical: 12, gap: 10 }}>
            {profile.uses.length ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>
                <Text style={{ fontFamily: fonts.semibold }}>Good for: </Text>
                {profile.uses.join(' · ')}
              </Text>
            ) : null}
            {profile.howToUse ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>
                <Text style={{ fontFamily: fonts.semibold }}>How: </Text>
                {profile.howToUse}
              </Text>
            ) : null}
            {profile.compatibility ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>
                <Text style={{ fontFamily: fonts.semibold }}>Works with: </Text>
                {profile.compatibility}
              </Text>
            ) : null}
          </Group>
        </View>
      ) : null}
      {profile.alternatives.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Compare with</Eyebrow>
          <Group>
            {profile.alternatives.map((a, i) => (
              <GroupRow
                key={a.name}
                icon={ArrowsLeftRight}
                label={a.name}
                detail={a.reason}
                onPress={() => onAlternative(a.name)}
                last={i === profile.alternatives.length - 1}
              />
            ))}
          </Group>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function PricesPane({ profile }: { profile: ProductProfile }) {
  const offers = profile.offers.filter((o) => o.price);
  if (!offers.length) {
    return (
      <Tile style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <Storefront size={28} color={colors.bone3} weight="regular" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>No live listings found</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2, textAlign: 'center' }}>
          We couldn’t confirm a seller price right now. Check back soon — prices refresh often.
        </Text>
      </Tile>
    );
  }
  return (
    <View style={{ gap: 14 }}>
      <Tile tone="ink">
        <Eyebrow color="rgba(255,255,255,0.55)">Price range</Eyebrow>
        <Text style={{ marginTop: 6, fontFamily: fonts.bold, fontSize: 28, letterSpacing: -1, color: colors.white }}>
          {formatRange(profile.priceRange)}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          across {profile.priceRange?.count ?? offers.length} listings · outliers removed
        </Text>
      </Tile>
      <Group>
        {offers.map((o, i) => (
          <Pressable
            key={`${o.seller}-${i}`}
            onPress={() => void openLink(o.link)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              borderBottomWidth: i === offers.length - 1 ? 0 : 1,
              borderBottomColor: colors.line,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lac2, alignItems: 'center', justifyContent: 'center' }}>
              <Storefront size={17} color={colors.bone2} weight="regular" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{o.seller}</Text>
              {i === 0 ? <Pill label="Lowest price" tone="good" /> : o.rating ? <Stars rating={o.rating} /> : null}
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{formatPrice(o.price)}</Text>
            <ArrowSquareOut size={16} color={colors.hi} weight="bold" />
          </Pressable>
        ))}
      </Group>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, lineHeight: 17 }}>
        No seller pays to appear here. Prices come from public listings and can change — confirm on the seller’s page.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function VideosPane({ clips, loading }: { clips: JourneyClip[]; loading: boolean }) {
  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState<JourneyClip | null>(null);
  const cardW = Math.min(width, 430) / 2 - 22;
  if (loading) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: cardW, gap: 8 }}>
            <Shimmer height={cardW * 0.58} radius={14} />
            <Shimmer height={12} width="80%" />
          </View>
        ))}
      </View>
    );
  }
  if (!clips.length) {
    return (
      <Tile style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <Play size={28} color={colors.bone3} weight="regular" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>No explainer videos yet</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2, textAlign: 'center' }}>
          We look for short, useful videos about setup, use and long-term experience.
        </Text>
      </Tile>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
        Learn the product in minutes — how it works, how to use it, and how it holds up.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {clips.map((clip) => (
          <Pressable
            key={clip.id}
            onPress={() => {
              hapticTap();
              setActive(clip);
            }}
            style={({ pressed }) => ({ width: cardW, gap: 6, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ width: cardW, height: cardW * 0.58, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.wineDeep }}>
              <Image source={{ uri: clip.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View
                style={{
                  position: 'absolute',
                  left: 8,
                  bottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Play size={10} color={colors.white} weight="fill" />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>{clipLabel(clip)}</Text>
              </View>
            </View>
            <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.bone }}>
              {clip.title}
            </Text>
          </Pressable>
        ))}
      </View>
      <Modal visible={Boolean(active)} animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={{ flex: 1, backgroundColor: colors.wine, paddingTop: Platform.OS === 'ios' ? 54 : 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>
              {active?.title}
            </Text>
            <Pressable onPress={() => setActive(null)} hitSlop={10} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color={colors.bone} weight="bold" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40, minHeight: height * 0.6 }}>
            {active ? <OfficialEmbed clip={active} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function SourcesSheet({ profile, visible, onClose }: { profile: ProductProfile | null; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={{ flex: 1, backgroundColor: colors.wine, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.bone }}>Receipts</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
              Every point links back to the people and pages it came from.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={colors.bone} weight="bold" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Group>
            {(profile?.sources ?? []).map((s, i, all) => (
              <GroupRow
                key={s.url}
                icon={Globe}
                label={s.title || s.domain}
                detail={`${s.n} · ${s.kind === 'community' ? 'Community' : s.kind === 'review' ? 'Review' : 'Web'} · ${s.domain}`}
                onPress={() => void openLink(s.url)}
                last={i === all.length - 1}
              />
            ))}
          </Group>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

const STEPS = [
  'Finding the exact product',
  'Listening to owners on YouTube and Reddit',
  'Reading reviews and discussions',
  'Checking what sellers charge',
  'Marking what you need to know',
];

export function InvestigatingState() {
  const [step, setStep] = useState(0);
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i), i * 2800));
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      timers.forEach(clearTimeout);
      loop.stop();
    };
  }, [pulse]);
  return (
    <View style={{ gap: 14 }}>
      <Tile style={{ gap: 14 }}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {done ? (
                <CheckCircle size={20} color={colors.sage} weight="fill" />
              ) : current ? (
                <Animated.View style={{ opacity: pulse }}>
                  <ActivityIndicator size="small" color={colors.hi} />
                </Animated.View>
              ) : (
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.line }} />
              )}
              <Text
                style={{
                  fontFamily: current ? fonts.semibold : fonts.regular,
                  fontSize: 15,
                  color: done || current ? colors.bone : colors.bone3,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </Tile>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Shimmer height={104} radius={20} style={{ flex: 1 }} width="48%" />
        <Shimmer height={104} radius={20} style={{ flex: 1 }} width="48%" />
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3, textAlign: 'center' }}>
        We’re reading real people so you don’t have to. First look takes a few seconds.
      </Text>
    </View>
  );
}
