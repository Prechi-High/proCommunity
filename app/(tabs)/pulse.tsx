import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillTabs, SectionHead, ThreadCard } from '@/components/community';
import { CaretRight, ChatsCircle, Fire, Question, SmileyNervous, TrendUp } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage, Shimmer } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { fetchPulse, NICHES, nicheOf, timeAgo, type NicheId } from '@/lib/community';
import { hapticTap } from '@/lib/haptics';
import { rememberProduct } from '@/lib/products';
import type { TrendingProduct } from '@/lib/types';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function PulseScreen() {
  const router = useRouter();
  const [niche, setNiche] = useState<NicheId | 'all'>('all');
  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const data = pulse.data;

  const inNiche = (category: string | null | undefined) => niche === 'all' || nicheOf(category) === niche;
  const trending = (data?.trending ?? []).filter((t) => inNiche(t.category));
  const threads = (data?.threads ?? []).filter((t) => inNiche(t.category));
  const worries = threads.filter((t) => t.kind === 'worry');
  const open = threads.filter((t) => t.kind !== 'worry');
  const asks = data?.asks ?? [];
  const maxHeat = Math.max(1, ...trending.map((t) => t.heat));

  const tabs = useMemo(() => {
    const present = new Set((data?.trending ?? []).map((t) => nicheOf(t.category)));
    (data?.threads ?? []).forEach((t) => present.add(nicheOf(t.category)));
    return [
      { id: 'all' as const, label: 'Everything' },
      ...NICHES.filter((n) => present.has(n.id)).map((n) => ({ id: n.id as NicheId, label: n.label })),
    ];
  }, [data]);

  const openProduct = (t: Pick<TrendingProduct, 'id' | 'name' | 'brand' | 'category' | 'image'>, tab?: string) => {
    rememberProduct({ id: t.id, name: t.name, brand: t.brand, category: t.category, heroImageUrl: t.image });
    router.push({ pathname: '/product/[id]', params: { id: t.id, q: t.name, ...(tab ? { tab } : {}) } } as Href);
  };
  const openThread = (id: string) => router.push({ pathname: '/thread/[id]', params: { id } } as Href);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, gap: 22 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulse.isRefetching} onRefresh={() => void pulse.refetch()} tintColor={colors.hi} />}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 6 }}>
          <Eyebrow color={colors.hi}>Live from the community</Eyebrow>
          <Text style={{ fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, lineHeight: 38, color: colors.bone }}>Pulse</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 21, color: colors.bone2 }}>
            What people are researching, asking and worrying about before they buy.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
          <Stat value={data?.stats.productsResearched} label="products researched" />
          <Stat value={data?.stats.questionsAsked} label="questions asked" />
          <Stat value={data?.stats.actionsThisWeek} label="actions this week" />
        </View>

        {tabs.length > 2 ? <PillTabs options={tabs} value={niche} onChange={setNiche} /> : null}

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <SectionHead title="Most researched" icon={<Fire size={20} color={colors.coral} weight="fill" />} />
          {pulse.isLoading ? (
            <View style={{ gap: 10 }}>
              <Shimmer height={64} radius={16} />
              <Shimmer height={64} radius={16} />
              <Shimmer height={64} radius={16} />
            </View>
          ) : pulse.isError ? (
            <View style={{ gap: 10, alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>The pulse didn’t load.</Text>
              <PrimaryButton label="Try again" onPress={() => void pulse.refetch()} />
            </View>
          ) : trending.length ? (
            <View style={{ backgroundColor: colors.lac, borderRadius: 20, overflow: 'hidden' }}>
              {trending.slice(0, 10).map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    hapticTap();
                    openProduct(t);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderBottomWidth: i < Math.min(trending.length, 10) - 1 ? 1 : 0,
                    borderBottomColor: colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ width: 22, fontFamily: fonts.bold, fontSize: 16, color: i < 3 ? colors.hi : colors.bone3, textAlign: 'center' }}>{i + 1}</Text>
                  <ProductImage uri={t.image} category={t.category} size={46} radius={12} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>{t.name}</Text>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.lac2, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.max(8, (t.heat / maxHeat) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: colors.hi }} />
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                      {[t.views && plural(t.views, 'view'), t.asks && plural(t.asks, 'question'), t.compares && plural(t.compares, 'compare'), t.threads && plural(t.threads, 'thread')]
                        .filter(Boolean)
                        .join(' · ') || t.category}
                    </Text>
                  </View>
                  <CaretRight size={14} color={colors.bone3} weight="bold" />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Nothing trending in this niche yet.</Text>
          )}
        </View>

        {asks.length && niche === 'all' ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <SectionHead title="What people ask owners" icon={<Question size={20} color={colors.hi} weight="bold" />} />
            <View style={{ gap: 8 }}>
              {asks.slice(0, 6).map((a, i) => (
                <Pressable
                  key={`${a.created_at}-${i}`}
                  onPress={() => {
                    hapticTap();
                    openProduct({ id: a.product_id, name: a.product_name ?? a.product_id, brand: '', category: '', image: null }, 'discuss');
                  }}
                  style={({ pressed }) => ({ backgroundColor: colors.lac, borderRadius: 16, padding: 14, gap: 6, opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.bone }}>“{a.question}”</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                    about {a.product_name ?? 'a product'} · {timeAgo(a.created_at)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {worries.length ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <SectionHead title="Worries before buying" icon={<SmileyNervous size={20} color={colors.honey} weight="bold" />} />
            {worries.slice(0, 5).map((t) => (
              <ThreadCard key={t.id} thread={t} showProduct onPress={() => openThread(t.id)} />
            ))}
          </View>
        ) : null}

        {open.length ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <SectionHead title="Open conversations" icon={<ChatsCircle size={20} color={colors.hi} weight="bold" />} />
            {open.slice(0, 8).map((t) => (
              <ThreadCard key={t.id} thread={t} showProduct onPress={() => openThread(t.id)} />
            ))}
          </View>
        ) : null}

        <View style={{ marginHorizontal: 16, backgroundColor: colors.black, borderRadius: 22, padding: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TrendUp size={18} color={colors.hi} weight="bold" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>For brands & sellers</Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4, color: colors.white }}>
            Every search, question and worry here is a real buying signal.
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)' }}>
            See what customers compare you with, what they fear before paying, and what owners praise — straight from the people deciding.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.lac, borderRadius: 16, padding: 12, gap: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.6, color: colors.bone }}>{value ?? '–'}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 14, color: colors.bone3 }}>{label}</Text>
    </View>
  );
}
