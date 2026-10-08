import { Pressable, ScrollView, Text, View } from 'react-native';

import { ArrowsLeftRight, Camera, DeviceMobile, Lightning, MagnifyingGlass, Sparkle } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage, Stars, Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import type { Product } from '@/lib/types';
import type { ProductProfile } from '@/lib/types';

type Props = {
  product: Product;
  profile: ProductProfile | null;
  onUnmask: () => void;
  onCompare: () => void;
  onExplore: (section: 'scorecard' | 'reviews' | 'videos') => void;
};

function featureTiles(profile: ProductProfile | null) {
  const specs = profile?.specs?.slice(0, 4) ?? [];
  if (specs.length >= 2) {
    return specs.map((s) => ({ title: s.label, body: s.value }));
  }
  const praise = profile?.praise?.slice(0, 4) ?? [];
  return praise.map((p) => ({ title: p.text.slice(0, 28), body: p.source ?? 'Owner reports' }));
}

export function ProductFoundView({ product, profile, onUnmask, onCompare, onExplore }: Props) {
  const name = profile?.identity.name || product.name;
  const brand = profile?.identity.brand || product.brand;
  const variant = [profile?.identity.variant, profile?.identity.size].filter(Boolean).join(' · ');
  const rating = profile?.rating ?? product.rating;
  const ratingCount = profile?.ratingCount ?? product.ratingCount;
  const summary = profile?.summary || product.description || '';
  const tiles = featureTiles(profile);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 20 }} showsVerticalScrollIndicator={false}>
      <View style={{ borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.lac }}>
        <ProductImage uri={product.heroImageUrl} category={product.category} size={360} radius={0} style={{ width: '100%', height: 280 }} />
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.8, color: colors.bone }}>{name}</Text>
            {brand ? <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone2 }}>{brand}</Text> : null}
            {variant ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>{variant}</Text> : null}
          </View>
        </View>
        {rating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Stars rating={rating} size={14} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>
              {rating.toFixed(1)}
              {ratingCount ? ` (${ratingCount >= 1000 ? `${(ratingCount / 1000).toFixed(1)}K` : ratingCount})` : ''}
            </Text>
          </View>
        ) : null}
        {product.category ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.chip, backgroundColor: colors.hiSoft }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.hiInk }}>{product.category}</Text>
            </View>
          </View>
        ) : null}
        {summary ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2, marginTop: 6 }}>{summary}</Text>
        ) : null}
      </View>

      {tiles.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {tiles.map((t, i) => (
            <Tile key={`${t.title}-${i}`} style={{ width: '47%', flexGrow: 1, gap: 4, minHeight: 88 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }} numberOfLines={2}>{t.title}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }} numberOfLines={2}>{t.body}</Text>
            </Tile>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <PrimaryButton label="Unmask this product" icon={MagnifyingGlass} tone="ink" onPress={onUnmask} />
        <Pressable
          onPress={onCompare}
          accessibilityRole="button"
          style={{
            minHeight: 48,
            borderRadius: radii.button,
            borderWidth: 1.5,
            borderColor: colors.bone,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <ArrowsLeftRight size={18} color={colors.bone} weight="bold" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>Compare</Text>
        </Pressable>
      </View>

      <View style={{ borderRadius: radii.card, backgroundColor: colors.wineDeep, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>See what&apos;s inside</Eyebrow>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>After you unmask</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { id: 'scorecard' as const, label: 'Product scorecard', sub: 'Strengths & gaps', Icon: Sparkle },
            { id: 'reviews' as const, label: 'Owner reviews', sub: 'Real experiences', Icon: Camera },
            { id: 'videos' as const, label: 'Video evidence', sub: 'Tests & comparisons', Icon: DeviceMobile },
          ].map(({ id, label, sub, Icon }) => (
            <Pressable
              key={id}
              onPress={() => onExplore(id)}
              style={{ flex: 1, backgroundColor: colors.lac, borderRadius: 12, padding: 12, gap: 6, minHeight: 100 }}
            >
              <Icon size={20} color={colors.hi} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.bone }}>{label}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{sub}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Lightning size={14} color={colors.bone3} weight="fill" />
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone2, flex: 1 }}>
            Unmask organises public evidence — not a buy/don&apos;t-buy verdict.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
