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
import {
  ArrowSquareOut,
  ArrowsLeftRight,
  CheckCircle,
  Globe,
  Play,
  SealCheck,
  Storefront,
  ThumbsDown,
  ThumbsUp,
  X,
} from '@/components/icons';
import { Eyebrow, Group, GroupRow, Pill, ScoreDial, Shimmer, Stars, Tile } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { formatPrice, formatRange } from '@/lib/products';
import type { Cited, EvidenceSource, ProductProfile } from '@/lib/types';
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

function sourceFor(profile: ProductProfile, n: number | null): EvidenceSource | undefined {
  return n == null ? undefined : profile.sources.find((s) => s.n === n);
}

function verifiedLabel(iso: string): string {
  const days = Math.floor((Date.now() - +new Date(iso)) / 86_400_000);
  if (days <= 0) return 'verified today';
  if (days === 1) return 'verified yesterday';
  return `verified ${days} days ago`;
}

const H = ({ children }: { children: string }) => (
  <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>{children}</Text>
);

// ---------------------------------------------------------------------------
// Overview — the whole decision at a glance, bento style.

export function OverviewPane({
  profile,
  onOpenSources,
  onGo,
}: {
  profile: ProductProfile;
  onOpenSources: () => void;
  onGo: (tab: 'reviews' | 'prices' | 'specs') => void;
}) {
  const topPraise = profile.praise[0]?.text;
  const topComplaint = profile.complaints[0]?.text;
  const range = formatRange(profile.priceRange);
  const bandTone = profile.band === 'High' ? 'good' : profile.band === 'Likely' ? 'accent' : 'warn';
  return (
    <View style={{ gap: 12 }}>
      <Tile tone="ink" style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Eyebrow color="rgba(255,255,255,0.55)">Sourced verdict</Eyebrow>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16.5, lineHeight: 22, color: colors.white, letterSpacing: -0.2 }}>
              {profile.verdict || profile.summary || 'We gathered what the web knows about this product.'}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <ScoreDial score={profile.score} size={84} stroke={8} onDark />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Sourced score</Text>
          </View>
        </View>
      </Tile>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Tile style={{ flex: 1, minHeight: 104, justifyContent: 'space-between' }} onPress={() => onGo('reviews')}>
          <Eyebrow>Rating</Eyebrow>
          {profile.rating ? (
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1, color: colors.bone }}>
                {profile.rating.toFixed(1)}
                <Text style={{ fontSize: 16, color: colors.bone3 }}> / 5</Text>
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                {profile.ratingCount ? `${profile.ratingCount.toLocaleString()} ratings` : 'store ratings'}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>
              {profile.praise.length} praised · {profile.complaints.length} flagged
            </Text>
          )}
        </Tile>
        <Tile style={{ flex: 1, minHeight: 104, justifyContent: 'space-between' }} onPress={() => onGo('prices')}>
          <Eyebrow>Price</Eyebrow>
          {range ? (
            <View style={{ gap: 2 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.8, color: colors.bone }}>
                {formatPrice(profile.offers[0]?.price) || range}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                lowest of {profile.priceRange?.count ?? profile.offers.length} listings
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>No live listings yet</Text>
          )}
        </Tile>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Tile style={{ flex: 1, backgroundColor: colors.sageSoft }} onPress={() => onGo('reviews')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThumbsUp size={14} color={colors.sageInk} weight="fill" />
            <Eyebrow color={colors.sageInk}>People love</Eyebrow>
          </View>
          <Text numberOfLines={4} style={{ marginTop: 8, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.bone }}>
            {topPraise ?? 'No clear praise yet'}
          </Text>
        </Tile>
        <Tile style={{ flex: 1, backgroundColor: colors.coralSoft }} onPress={() => onGo('reviews')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThumbsDown size={14} color={colors.coral} weight="fill" />
            <Eyebrow color={colors.coral}>Watch for</Eyebrow>
          </View>
          <Text numberOfLines={4} style={{ marginTop: 8, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.bone }}>
            {topComplaint ?? 'No repeated complaints found'}
          </Text>
        </Tile>
      </View>

      {profile.bestFor.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone2, marginRight: 2 }}>Best for</Text>
          {profile.bestFor.slice(0, 3).map((b) => (
            <Pill key={b} label={b.length > 38 ? `${b.slice(0, 36)}…` : b} tone="accent" />
          ))}
        </View>
      ) : null}

      <Pressable onPress={onOpenSources} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
        <Pill label={`${profile.band} confidence`} tone={bandTone} icon={SealCheck} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
          {profile.sources.length} sources · {verifiedLabel(profile.verifiedAt)}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>Sources</Text>
      </Pressable>
    </View>
  );
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

function CitedList({ items, tone, profile }: { items: Cited[]; tone: 'good' | 'bad'; profile: ProductProfile }) {
  const color = tone === 'good' ? colors.sage : colors.coral;
  return (
    <Group>
      {items.map((item, i) => {
        const src = sourceFor(profile, item.source);
        return (
          <Pressable
            key={`${item.text}-${i}`}
            disabled={!src}
            onPress={() => void openLink(src?.url)}
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.line,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 7 }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.bone }}>{item.text}</Text>
              {src ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  {src.kind === 'community' ? 'Community · ' : src.kind === 'review' ? 'Review · ' : ''}
                  {src.domain}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Group>
  );
}

export function ReviewsPane({ profile }: { profile: ProductProfile }) {
  const p = profile.praise.length;
  const c = profile.complaints.length;
  const total = Math.max(1, p + c);
  return (
    <View style={{ gap: 16 }}>
      <Tile>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <Eyebrow>What people say</Eyebrow>
            <Stars rating={profile.rating} count={profile.ratingCount} size={14} />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
            {p} positives · {c} concerns
          </Text>
        </View>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 14, backgroundColor: colors.wineDeep }}>
          <View style={{ width: `${(p / total) * 100}%`, backgroundColor: colors.sage }} />
          <View style={{ width: `${(c / total) * 100}%`, backgroundColor: colors.coral }} />
        </View>
      </Tile>

      {p ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThumbsUp size={15} color={colors.sage} weight="fill" />
            <H>People love</H>
          </View>
          <CitedList items={profile.praise} tone="good" profile={profile} />
        </View>
      ) : null}
      {c ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThumbsDown size={15} color={colors.coral} weight="fill" />
            <H>Watch for</H>
          </View>
          <CitedList items={profile.complaints} tone="bad" profile={profile} />
        </View>
      ) : null}
      {profile.bestFor.length || profile.notFor.length ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {profile.bestFor.length ? (
            <Tile style={{ flex: 1, gap: 8 }}>
              <Eyebrow color={colors.sageInk}>Great for</Eyebrow>
              {profile.bestFor.map((b) => (
                <View key={b} style={{ flexDirection: 'row', gap: 6 }}>
                  <CheckCircle size={14} color={colors.sage} weight="fill" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.bone }}>{b}</Text>
                </View>
              ))}
            </Tile>
          ) : null}
          {profile.notFor.length ? (
            <Tile style={{ flex: 1, gap: 8 }}>
              <Eyebrow color={colors.coral}>Skip if</Eyebrow>
              {profile.notFor.map((b) => (
                <View key={b} style={{ flexDirection: 'row', gap: 6 }}>
                  <X size={14} color={colors.coral} weight="bold" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.bone }}>{b}</Text>
                </View>
              ))}
            </Tile>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

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
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.bone }}>Evidence</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
              Every claim links back to where it came from.
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
  'Confirming the exact product',
  'Reading specifications',
  'Collecting reviews and discussions',
  'Comparing seller prices',
  'Organising the evidence',
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
        First look takes a few seconds. After that it’s instant.
      </Text>
    </View>
  );
}
