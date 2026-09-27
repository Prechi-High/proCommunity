import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemberGate } from '@/components/community';
import { ArrowLeft, CaretRight, Plus, SealCheck, Warning } from '@/components/icons';
import { Lightbox } from '@/components/Lightbox';
import { Eyebrow, ProductImage, ScoreDial, Shimmer } from '@/components/kit';
import { Composer, KIND_STYLE, PostCard } from '@/components/social';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { fetchFeed, fetchRoom, KIND_LABEL } from '@/lib/community';
import { hapticTap } from '@/lib/haptics';
import { displayName, getKnownProduct, loadProduct } from '@/lib/products';
import type { ThreadKind } from '@/lib/types';

/** A product's room: how it's faring with the people deciding, and everything they're saying. */
export default function RoomScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const id = routeId(params.id);
  const { requireMember, gate } = useMemberGate();
  const [composing, setComposing] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const product = useQuery({ queryKey: ['product', id], queryFn: () => loadProduct(id), enabled: Boolean(id), staleTime: 10 * 60_000 });
  const room = useQuery({ queryKey: ['room', id], queryFn: () => fetchRoom(id), enabled: Boolean(id), staleTime: 60_000 });
  const feed = useQuery({ queryKey: ['feed', 'room', id], queryFn: () => fetchFeed({ productId: id, sort: 'hot' }), enabled: Boolean(id), staleTime: 20_000 });

  const p = product.data ?? getKnownProduct(id);
  const name = p ? displayName(p) : typeof params.name === 'string' ? params.name : id.replace(/-/g, ' ');
  const r = room.data;
  const kinds = Object.entries(r?.byKind ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as Array<[ThreadKind, number]>;
  const maxKind = Math.max(1, ...kinds.map(([, n]) => n));
  const seed = useMemo(
    () => ({ id, name: p?.name ?? name, brand: p?.brand ?? '', category: p?.category ?? '', heroImageUrl: p?.heroImageUrl ?? null }),
    [id, p?.name, p?.brand, p?.category, p?.heroImageUrl, name],
  );
  const openProduct = () => router.push({ pathname: '/product/[id]', params: { id, q: name } } as Href);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/pulse' as Href))}
          accessibilityLabel="Back"
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Product room</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 18 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={openProduct} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ProductImage uri={p?.heroImageUrl} category={p?.category ?? ''} size={76} radius={18} />
          <View style={{ flex: 1, gap: 3 }}>
            {p?.brand ? <Eyebrow color={colors.hi}>{p.brand}</Eyebrow> : null}
            <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 25, letterSpacing: -0.5, color: colors.bone }}>{name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>Full profile</Text>
              <CaretRight size={12} color={colors.hi} weight="bold" />
            </View>
          </View>
        </Pressable>

        {room.isLoading ? (
          <Shimmer height={170} radius={22} />
        ) : r ? (
          <View style={{ backgroundColor: colors.black, borderRadius: 22, padding: 18, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ScoreDial score={r.score} size={84} stroke={8} onDark />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>How it’s faring</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.white }}>{r.consensus || 'Owners are still weighing in on this one.'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat value={r.viewsThisWeek} label="looking this week" />
              <Stat value={r.posts} label="posts" />
              <Stat value={r.compares30d} label="compared (30d)" />
              <Stat value={r.memberRating ?? '–'} label={r.ratedBy ? `member rating · ${r.ratedBy}` : 'member rating'} />
            </View>
            {r.praise.length || r.complaints.length ? (
              <View style={{ gap: 8 }}>
                {r.praise.slice(0, 2).map((t) => (
                  <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <SealCheck size={15} color="#5BD68A" weight="fill" style={{ marginTop: 2 }} />
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' }}>{t}</Text>
                  </View>
                ))}
                {r.complaints.slice(0, 2).map((t) => (
                  <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Warning size={15} color="#FF8A7A" weight="fill" style={{ marginTop: 2 }} />
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' }}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {kinds.length ? (
          <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 16, gap: 10 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>What people post about it</Text>
            {kinds.map(([k, n]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ width: 92, fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>{KIND_LABEL[k]}</Text>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.lac2, overflow: 'hidden' }}>
                  <View style={{ width: `${(n / maxKind) * 100}%`, height: 8, borderRadius: 4, backgroundColor: KIND_STYLE[k]?.fg ?? colors.hi }} />
                </View>
                <Text style={{ width: 24, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{n}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>Posts</Text>
          {feed.isLoading ? (
            <Shimmer height={170} radius={22} />
          ) : feed.data?.length ? (
            feed.data.map((t) => (
              <PostCard
                key={t.id}
                thread={t}
                requireMember={requireMember}
                onOpen={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } } as Href)}
                onProduct={openProduct}
                onImage={setPhoto}
              />
            ))
          ) : (
            <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 18, gap: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>No posts here yet</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>Own it or thinking about it? Start the room’s first conversation.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          hapticTap();
          requireMember(() => setComposing(true));
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 22,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.hi,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Plus size={18} color={colors.white} weight="bold" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.white }}>Post about {p?.name ?? 'this'}</Text>
      </Pressable>

      <Composer
        visible={composing}
        onClose={() => setComposing(false)}
        initialProduct={seed}
        onPosted={(t) => {
          setComposing(false);
          void qc.invalidateQueries({ queryKey: ['feed'] });
          void qc.invalidateQueries({ queryKey: ['room', id] });
          router.push({ pathname: '/thread/[id]', params: { id: t.id } } as Href);
        }}
      />
      <Lightbox images={photo ? [{ url: photo }] : []} index={photo ? 0 : null} onClose={() => setPhoto(null)} />
      {gate}
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 10, gap: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.white }}>{value}</Text>
      <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 13, color: 'rgba(255,255,255,0.6)' }}>{label}</Text>
    </View>
  );
}
