import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrowClockwise, ArrowLeft, BookmarkSimple, ChatsCircle, ShareNetwork } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage, Segmented } from '@/components/kit';
import {
  InvestigatingState,
  openLink,
  OverviewPane,
  PricesPane,
  ReviewsPane,
  SourcesSheet,
  SpecsPane,
  VideosPane,
} from '@/components/product/Panes';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { displayName, formatPrice, getKnownProduct, investigateProduct, rememberProduct, slugify } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import { loadProductClips } from '@/lib/videos';

type Tab = 'overview' | 'specs' | 'reviews' | 'prices' | 'videos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'specs', label: 'Specs' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'prices', label: 'Prices' },
  { id: 'videos', label: 'Videos' },
];

export default function ProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; q?: string }>();
  const id = routeId(params.id);
  const q = typeof params.q === 'string' ? params.q : undefined;
  const [tab, setTab] = useState<Tab>('overview');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  useAppStore((s) => s.knownProducts[id]);
  const known = getKnownProduct(id);
  const saved = favorites.some((f) => f.productId === id);

  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  const intel = useQuery({
    queryKey: ['intel', id],
    queryFn: () => investigateProduct({ id, query: q }),
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const profile = intel.data ?? null;
  const product = getKnownProduct(id) ?? known;
  const name = product ? displayName(product) : profile?.identity.name ?? q ?? '';

  const clips = useQuery({
    queryKey: ['clips', id],
    queryFn: () =>
      loadProductClips({
        id,
        name: profile?.identity.name || product?.name || q || '',
        brand: profile?.identity.brand || product?.brand || '',
      }),
    enabled: Boolean(id) && (Boolean(profile) || Boolean(product?.name)),
    staleTime: 60 * 60_000,
  });

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [tab, profile, fade]);

  const image = product?.heroImageUrl || profile?.images[0] || null;
  const lowest = profile?.offers.find((o) => o.price) ?? null;
  const brand = profile?.identity.brand || product?.brand || '';
  const category = profile?.identity.category || product?.category || '';

  const openAlternative = (altName: string) => {
    const altId = slugify(altName);
    rememberProduct({ id: altId, name: altName, brand: '', category: category || 'Product' });
    router.push({ pathname: '/product/[id]', params: { id: altId, q: altName } } as Href);
  };

  const pane = useMemo(() => {
    if (!profile) return null;
    switch (tab) {
      case 'overview':
        return <OverviewPane profile={profile} onOpenSources={() => setSourcesOpen(true)} onGo={setTab} />;
      case 'specs':
        return <SpecsPane profile={profile} onAlternative={openAlternative} />;
      case 'reviews':
        return <ReviewsPane profile={profile} />;
      case 'prices':
        return <PricesPane profile={profile} />;
      case 'videos':
        return <VideosPane clips={clips.data ?? []} loading={clips.isLoading} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile, clips.data, clips.isLoading]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <RoundButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </RoundButton>
        <View style={{ flex: 1 }} />
        <RoundButton
          label="Share"
          onPress={() => {
            void Share.share({ message: `${name} — see the full breakdown on Sourced` });
          }}
        >
          <ShareNetwork size={18} color={colors.bone} weight="bold" />
        </RoundButton>
        <RoundButton
          label={saved ? 'Remove from saved' : 'Save'}
          onPress={() => {
            toggleFavorite(id);
            if (!saved) hapticSuccess();
          }}
          active={saved}
        >
          <BookmarkSimple size={18} color={saved ? colors.white : colors.bone} weight={saved ? 'fill' : 'bold'} />
        </RoundButton>
      </View>

      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, alignItems: 'center' }}>
        <ProductImage uri={image} category={category} size={96} radius={20} style={{ borderWidth: 0 }} />
        <View style={{ flex: 1, gap: 4 }}>
          {brand ? <Eyebrow color={colors.hi}>{brand}</Eyebrow> : null}
          <Text numberOfLines={3} style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 25, letterSpacing: -0.5, color: colors.bone }}>
            {profile?.identity.name || name || 'Product'}
          </Text>
          {category ? (
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
              {category}
              {profile?.identity.variant ? ` · ${profile.identity.variant}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {intel.isLoading ? (
          <InvestigatingState />
        ) : intel.isError || !profile ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 40 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>We couldn’t finish the investigation</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center', lineHeight: 20 }}>
              The connection dropped or sources were slow. Try again — nothing is lost.
            </Text>
            <PrimaryButton label="Try again" icon={ArrowClockwise} onPress={() => void intel.refetch()} />
          </View>
        ) : (
          <Animated.View style={{ opacity: fade }}>{pane}</Animated.View>
        )}
      </ScrollView>

      {profile ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 6,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.lac,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
              {lowest ? `Lowest at ${lowest.seller}` : 'Price'}
            </Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: colors.bone }}>
              {lowest ? formatPrice(lowest.price) : '—'}
            </Text>
          </View>
          <RoundButton label="Discuss" onPress={() => router.push(`/product/${id}/community` as Href)} size={46}>
            <ChatsCircle size={20} color={colors.bone} weight="bold" />
          </RoundButton>
          <PrimaryButton
            label={lowest ? 'View deal' : 'See prices'}
            onPress={() => (lowest?.link ? void openLink(lowest.link) : setTab('prices'))}
            style={{ minWidth: 130 }}
          />
        </View>
      ) : null}

      <SourcesSheet profile={profile} visible={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </SafeAreaView>
  );
}

function RoundButton({
  children,
  onPress,
  label,
  active,
  size = 38,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: active ? colors.hi : size > 40 ? colors.lac2 : colors.lac,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
