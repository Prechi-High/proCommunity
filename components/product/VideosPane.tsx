import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfficialEmbed } from '@/components/VideoEmbed';
import { Play, X } from '@/components/icons';
import { Shimmer, Tile } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { FALLBACK_TAGS, tagLabel, type ContentTagKey } from '@/lib/taxonomy';
import type { Product } from '@/lib/types';
import { clipLabel, loadTagClips, loadTagCounts, type JourneyClip } from '@/lib/videos';

type VideoProduct = Pick<Product, 'id' | 'name' | 'brand' | 'category'>;
type Filter = 'all' | ContentTagKey;

const PAD = 16;

function useTagClips(product: VideoProduct, tag: ContentTagKey | null) {
  return useQuery({
    queryKey: ['tagclips', product.id, tag],
    queryFn: () => loadTagClips(product, tag!),
    enabled: Boolean(tag && product.id),
    staleTime: 30 * 60_000,
  });
}

function TagChips({
  value,
  onChange,
  counts,
  includeAll,
  exclude,
}: {
  value: Filter | null;
  onChange: (tag: Filter) => void;
  counts?: Partial<Record<ContentTagKey, number>>;
  includeAll?: boolean;
  exclude?: ContentTagKey | null;
}) {
  const options: { id: Filter; label: string; count?: number }[] = [
    ...(includeAll ? [{ id: 'all' as const, label: 'All' }] : []),
    ...FALLBACK_TAGS.filter((t) => t.tagKey !== exclude).map((t) => ({ id: t.tagKey, label: t.tagLabel, count: counts?.[t.tagKey] })),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: PAD }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              if (!on) hapticSelect();
              onChange(o.id);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 34,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: on ? colors.black : colors.lac,
              borderWidth: on ? 0 : 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: on ? colors.white : colors.bone }}>{o.label}</Text>
            {o.count ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: on ? 'rgba(255,255,255,0.6)' : colors.bone3 }}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ClipCard({ clip, width, label, onPress }: { clip: JourneyClip; width: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ width, gap: 6, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width, height: width * 0.5625, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.wineDeep }}>
        <Image source={{ uri: clip.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(0,0,0,0.72)',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Play size={10} color={colors.white} weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>{label}</Text>
        </View>
        {clip.durationSeconds ? (
          <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>{duration(clip.durationSeconds)}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.bone }}>
        {clip.title}
      </Text>
      {clip.author ? (
        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
          {clip.author}
        </Text>
      ) : null}
    </Pressable>
  );
}

function duration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function Grid({ clips, label, onOpen, contentWidth }: { clips: JourneyClip[]; label: (c: JourneyClip) => string; onOpen: (c: JourneyClip) => void; contentWidth: number }) {
  const cols = contentWidth > 900 ? 4 : contentWidth > 560 ? 3 : 2;
  const gap = 12;
  const cardW = (contentWidth - gap * (cols - 1)) / cols;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} width={cardW} label={label(clip)} onPress={() => onOpen(clip)} />
      ))}
    </View>
  );
}

function GridSkeleton({ contentWidth }: { contentWidth: number }) {
  const cardW = (contentWidth - 12) / 2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: cardW, gap: 8 }}>
          <Shimmer height={cardW * 0.5625} radius={14} />
          <Shimmer height={12} width="80%" />
        </View>
      ))}
    </View>
  );
}

export function VideosPane({ product, clips, loading }: { product: VideoProduct; clips: JourneyClip[]; loading: boolean }) {
  const { width } = useWindowDimensions();
  const contentWidth = width - PAD * 2;
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<{ clip: JourneyClip; tag: ContentTagKey } | null>(null);
  const counts = useQuery({ queryKey: ['tagcounts', product.id], queryFn: () => loadTagCounts(product.id), staleTime: 10 * 60_000 });
  const tagged = useTagClips(product, filter === 'all' ? null : filter);

  const list = filter === 'all' ? clips : tagged.data ?? [];
  const busy = filter === 'all' ? loading : tagged.isLoading;
  const labelFor = (c: JourneyClip) => (filter === 'all' ? clipLabel(c) : tagLabel(filter));

  const open = (clip: JourneyClip) =>
    setPlaying({ clip, tag: filter === 'all' ? clip.contentTags[0] ?? 'who_its_for' : filter });

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>Learn it in minutes</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
          Pick what you want to know — how it works, how to use it, how it holds up.
        </Text>
      </View>
      <View style={{ marginHorizontal: -PAD }}>
        <TagChips value={filter} onChange={setFilter} counts={counts.data} includeAll />
      </View>
      {busy ? (
        <GridSkeleton contentWidth={contentWidth} />
      ) : list.length ? (
        <Grid clips={list} label={labelFor} onOpen={open} contentWidth={contentWidth} />
      ) : (
        <Tile style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <Play size={28} color={colors.bone3} weight="regular" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, textAlign: 'center' }}>
            {filter === 'all' ? 'No explainer videos yet' : `No “${tagLabel(filter)}” videos yet`}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2, textAlign: 'center' }}>
            Try another topic above — we keep looking for short, useful videos.
          </Text>
        </Tile>
      )}

      <PlayerSheet product={product} playing={playing} onPlay={setPlaying} onClose={() => setPlaying(null)} />
    </View>
  );
}

function PlayerSheet({
  product,
  playing,
  onPlay,
  onClose,
}: {
  product: VideoProduct;
  playing: { clip: JourneyClip; tag: ContentTagKey } | null;
  onPlay: (p: { clip: JourneyClip; tag: ContentTagKey }) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [explore, setExplore] = useState<ContentTagKey | null>(null);
  const tag = playing?.tag ?? null;
  const same = useTagClips(product, tag);
  const other = useTagClips(product, explore && explore !== tag ? explore : null);

  const playerW = Math.min(width, 760) - PAD * 2;
  const playerH = Math.round(playerW * 0.5625);
  const railW = Math.min(220, playerW * 0.62);
  const more = (same.data ?? []).filter((c) => c.id !== playing?.clip.id);

  const play = (clip: JourneyClip, t: ContentTagKey) => {
    onPlay({ clip, tag: t });
    setExplore(null);
    scroller.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <Modal visible={Boolean(playing)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: Platform.OS === 'web' ? 14 : 4, paddingBottom: 10, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.hi }}>{tag ? tagLabel(tag) : 'Video'}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>
              {product.brand ? `${product.brand} · ` : ''}
              {product.name}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close video"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} color={colors.bone} weight="bold" />
          </Pressable>
        </View>

        <ScrollView ref={scroller} contentContainerStyle={{ paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>
          {playing ? (
            <View style={{ paddingHorizontal: PAD, gap: 12, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
              <OfficialEmbed key={playing.clip.id} clip={playing.clip} height={playerH} />
              <View style={{ gap: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: colors.bone }}>{playing.clip.title}</Text>
                {playing.clip.author ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>{playing.clip.author}</Text> : null}
              </View>
            </View>
          ) : null}

          {tag ? (
            <View style={{ gap: 10 }}>
              <Text style={{ paddingHorizontal: PAD, fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: colors.bone }}>More on “{tagLabel(tag)}”</Text>
              {same.isLoading ? (
                <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: PAD }}>
                  <Shimmer height={railW * 0.5625} width={railW} radius={14} />
                  <Shimmer height={railW * 0.5625} width={railW} radius={14} />
                </View>
              ) : more.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: PAD }}>
                  {more.map((c) => (
                    <ClipCard key={c.id} clip={c} width={railW} label={tagLabel(tag)} onPress={() => play(c, tag)} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ paddingHorizontal: PAD, fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>This is the only one on this topic so far.</Text>
              )}
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <View style={{ paddingHorizontal: PAD, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: colors.bone }}>Learn something else</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>Pick a topic to see its videos.</Text>
            </View>
            <TagChips value={explore} onChange={(t) => setExplore(t as ContentTagKey)} exclude={tag} />
            {explore && explore !== tag ? (
              other.isLoading ? (
                <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: PAD }}>
                  <Shimmer height={railW * 0.5625} width={railW} radius={14} />
                  <Shimmer height={railW * 0.5625} width={railW} radius={14} />
                </View>
              ) : other.data?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: PAD }}>
                  {other.data.map((c) => (
                    <ClipCard key={c.id} clip={c} width={railW} label={tagLabel(explore)} onPress={() => play(c, explore)} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ paddingHorizontal: PAD, fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
                  No “{tagLabel(explore)}” videos yet — try another topic.
                </Text>
              )
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
