import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { AvatarStack, SectionHead, ThreadCard, TrendingCard } from '@/components/community';
import { Screen } from '@/components/Screen';
import { Typewriter, type TypedLine } from '@/components/Typewriter';
import { ArrowsLeftRight, Clock, Fire, Scan } from '@/components/icons';
import { Eyebrow, ProductImage, SearchBar, Shimmer, Tile } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { fetchPulse, nicheLabel, nicheOf, type NicheId } from '@/lib/community';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { displayName, getKnownProduct, rememberProduct } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { TrendingProduct } from '@/lib/types';
import { useScan } from '@/lib/useScan';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const TRY = ['AirPods Pro 2', 'Anker 20W charger', 'Nike Pegasus 41', 'Ninja blender', 'PS5 controller', 'Kindle Paperwhite'];

const HEADLINES: TypedLine[] = [
  { line: 'Know it before you buy it.', sub: 'Real owners. Real talk. Every product.' },
  { line: 'Smart people search first.', sub: 'Two minutes here beats two years of regret.' },
  { line: 'Remember the one that broke in a week?', sub: 'Its owners saw it coming. Ask them first.' },
  { line: 'Great in the ad. What about month six?', sub: 'Hear from the people who actually kept it.' },
  { line: 'Shazam for products.', sub: 'Point your camera. Know exactly what it is.' },
  { line: 'The box won’t tell you. Owners will.', sub: 'Hidden flaws and honest praise — before you pay.' },
  { line: 'Is it worth it — really?', sub: 'Answers from owners, not sellers.' },
  { line: 'Don’t guess. Know.', sub: 'Your money deserves the whole truth.' },
];

const HINTS = [
  'What are you thinking of buying?',
  'Try “AirPods Pro 2”',
  'Try “Ninja air fryer”',
  'Try “Nike Pegasus 41”',
  'Or snap it with the camera →',
];

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState<NicheId | 'all'>('all');
  const history = useAppStore((s) => s.searchHistory);
  const recentIds = useAppStore((s) => s.recentProductIds);
  const profile = useAppStore((s) => s.profile);
  useAppStore((s) => s.knownProducts);
  const addSearch = useAppStore((s) => s.addSearch);
  const scan = useScan();
  const [hint, setHint] = useState(0);
  useEffect(() => {
    if (query) return;
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 3200);
    return () => clearInterval(t);
  }, [query]);

  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const trending = pulse.data?.trending ?? [];
  const niches = useMemo(() => {
    const seen = new Set<NicheId>();
    trending.forEach((t) => seen.add(nicheOf(t.category)));
    return [...seen];
  }, [trending]);
  const shown = niche === 'all' ? trending : trending.filter((t) => nicheOf(t.category) === niche);
  const threads = (pulse.data?.threads ?? []).slice(0, 4);
  const stats = pulse.data?.stats;
  const faces = [...new Set(threads.map((t) => t.author_name))].map((name) => ({ name }));

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    addSearch(trimmed);
    router.push({ pathname: '/results', params: { q: trimmed } } as Href);
  };

  const openTrending = (t: TrendingProduct) => {
    rememberProduct({ id: t.id, name: t.name, brand: t.brand, category: t.category, heroImageUrl: t.image });
    router.push({ pathname: '/product/[id]', params: { id: t.id, q: t.name } } as Href);
  };

  const recent = recentIds.map((id) => getKnownProduct(id)).filter(Boolean).slice(0, 8);
  const chips = history.length ? history.slice(0, 6).map((h) => h.query) : TRY;

  return (
    <Screen>
      <View style={{ paddingTop: 18, gap: 22 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow color={colors.hi}>{profile ? `Welcome back, ${profile.displayName.split(' ')[0]}` : 'The product community'}</Eyebrow>
          <Typewriter
            lines={HEADLINES}
            style={{ fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, lineHeight: 38, color: colors.bone }}
            subStyle={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 21, color: colors.bone2 }}
          />
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmit={() => go(query)}
          onScan={scan.start}
          busy={scan.busy}
          placeholder={HINTS[hint]}
          animateScan
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8 }}>
          <AvatarStack people={faces.length >= 3 ? faces : [{ name: 'Ada N' }, { name: 'Kofi B' }, { name: 'Sam R' }, { name: 'Lina M' }]} size={24} max={4} ring={colors.wine} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.bone2 }}>
            {stats && (stats.questionsAsked || stats.productsResearched)
              ? `${plural(stats.productsResearched, 'product')} researched · ${plural(stats.questionsAsked, 'question')} asked this week`
              : 'Every answer here comes from people who used the product.'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile tone="ink" onPress={scan.start} style={{ flex: 1, padding: 16, gap: 12, minHeight: 132 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
              <Scan size={22} color={colors.white} weight="bold" />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white, letterSpacing: -0.3 }}>Snap it</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16, color: 'rgba(255,255,255,0.66)' }}>
                Seen it somewhere? Find out what it is.
              </Text>
            </View>
          </Tile>
          <Tile onPress={() => router.push('/compare' as Href)} style={{ flex: 1, padding: 16, gap: 12, minHeight: 132, backgroundColor: colors.hiSoft }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
              <ArrowsLeftRight size={22} color={colors.white} weight="bold" />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.hiInk, letterSpacing: -0.3 }}>Compare two</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16, color: colors.hiInk, opacity: 0.8 }}>
                Torn between them? Ask owners of both.
              </Text>
            </View>
          </Tile>
        </View>

        <View style={{ gap: 12 }}>
          <SectionHead
            title="Trending now"
            icon={<Fire size={20} color={colors.coral} weight="fill" />}
            action="Pulse"
            onAction={() => router.push('/pulse' as Href)}
          />
          {niches.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['all', ...niches] as const).map((n) => {
                const on = n === niche;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      hapticSelect();
                      setNiche(n);
                    }}
                    style={{ paddingHorizontal: 13, height: 32, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? colors.black : colors.lac, borderWidth: on ? 0 : 1, borderColor: colors.line }}
                  >
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? colors.white : colors.bone }}>{n === 'all' ? 'All' : nicheLabel(n)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {pulse.isLoading ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Shimmer height={190} width={148} radius={20} />
              <Shimmer height={190} width={148} radius={20} />
            </View>
          ) : shown.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
              {shown.slice(0, 10).map((t, i) => (
                <TrendingCard key={t.id} item={t} rank={i + 1} onPress={() => openTrending(t)} />
              ))}
            </ScrollView>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Search something — you’ll help set what’s trending.</Text>
          )}
        </View>

        {threads.length ? (
          <View style={{ gap: 12 }}>
            <SectionHead title="People are asking" action="See all" onAction={() => router.push('/pulse' as Href)} />
            {threads.map((t) => (
              <ThreadCard key={t.id} thread={t} showProduct onPress={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } } as Href)} />
            ))}
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Eyebrow>{history.length ? 'Your recent searches' : 'Curious? Try'}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  hapticTap();
                  go(c);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.lac,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                {history.length ? <Clock size={13} color={colors.bone3} weight="bold" /> : null}
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {recent.length ? (
          <View style={{ gap: 10 }}>
            <Eyebrow>Recently viewed</Eyebrow>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
              {recent.map((p) => (
                <Pressable
                  key={p!.id}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: p!.id } } as Href)}
                  style={{ width: 116, gap: 8 }}
                >
                  <ProductImage uri={p!.heroImageUrl} category={p!.category} size={116} radius={18} />
                  <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone, lineHeight: 17 }}>
                    {displayName(p!)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <ScanOverlay visible={scan.busy} preview={scan.preview} />
      {scan.sheet}
    </Screen>
  );
}

function ScanOverlay({ visible, preview }: { visible: boolean; preview: string | null }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 26 }}>
        {preview ? (
          <Image source={{ uri: preview }} style={{ width: 220, height: 220, borderRadius: 28 }} resizeMode="cover" />
        ) : null}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.white} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.white, letterSpacing: -0.3 }}>Identifying product</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 }}>
            Reading the label, logo and model — then we’ll find what owners say about it.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
