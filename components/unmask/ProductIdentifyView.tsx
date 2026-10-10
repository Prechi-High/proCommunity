import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Camera, CaretRight, CheckCircle, DeviceMobile, Lightning, Package, ShieldCheck } from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import type { Product, ProductProfile } from '@/lib/types';

const CREAM = '#F9F6F0';
const MAROON = '#6B0F1A';

type Props = {
  product: Product;
  profile: ProductProfile | null;
  photos: string[];
  onViewSpecs: () => void;
};

function pickSpec(profile: ProductProfile | null, keys: string[]): string | null {
  for (const s of profile?.specs ?? []) {
    const k = s.label.toLowerCase();
    if (keys.some((x) => k.includes(x))) return s.value;
  }
  return null;
}

export function ProductIdentifyView({ product, profile, photos, onViewSpecs }: Props) {
  const name = profile?.identity.name || product.name;
  const brand = profile?.identity.brand || product.brand || '';
  const summary = profile?.summary || product.description || '';
  const rating = profile?.rating ?? product.rating ?? null;
  const ratingCount = profile?.ratingCount ?? 0;
  const buyAgain =
    rating != null ? Math.min(96, Math.max(72, Math.round((rating / 5) * 100 - 2))) : null;

  const hero = photos[0] || product.heroImageUrl;
  const thumbs = photos.length > 0 ? photos : hero ? [hero] : [];
  const extra = Math.max(0, thumbs.length - 5);

  const storage = pickSpec(profile, ['storage', 'memory', 'capacity']) || '—';
  const display = pickSpec(profile, ['display', 'screen']) || '—';
  const camera = pickSpec(profile, ['camera', 'megapixel']) || '—';
  const battery = pickSpec(profile, ['battery', 'playback']) || '—';

  const categoryLabel = profile?.identity.category || product.category || 'Product';
  const sub = profile?.identity.subcategory;
  const pills = [categoryLabel, sub].filter(Boolean).slice(0, 3);

  const tagline =
    (profile?.verdict ? profile.verdict.split(/[.!?]/)[0]?.trim() : '') ||
    (summary ? summary.split(/[.!?]/)[0]?.trim() : '') ||
    'Real owners. Real experiences.';

  return (
    <View style={{ marginHorizontal: -16, backgroundColor: CREAM }}>
      <View style={{ height: 248, backgroundColor: '#1a0a0d' }}>
        {hero ? (
          <Image source={{ uri: hero }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <ProductImage uri={null} category={product.category} size={248} radius={0} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(26,10,13,0.85)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
        />
        <View style={{ position: 'absolute', right: 12, top: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.gold, borderRadius: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.gold, letterSpacing: 0.6 }}>{categoryLabel.toUpperCase()}</Text>
        </View>
        <Text
          style={{
            position: 'absolute',
            right: 16,
            bottom: 20,
            maxWidth: '55%',
            fontFamily: fonts.serifBold,
            fontSize: 15,
            color: 'rgba(255,255,255,0.92)',
            fontStyle: 'italic',
            textAlign: 'right',
          }}
          numberOfLines={3}
        >
          {tagline}
        </Text>
      </View>

      <View style={{ backgroundColor: CREAM, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {thumbs.slice(0, 5).map((url, i) => (
            <View
              key={`${url}-${i}`}
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                overflow: 'hidden',
                borderWidth: i === 0 ? 2 : 0,
                borderColor: colors.gold,
              }}
            >
              <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
            </View>
          ))}
          {extra > 0 ? (
            <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: '#e8e4dc', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: MAROON }}>+{extra}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: '#1a1a1a', letterSpacing: -0.5 }}>{name}</Text>
            {brand ? (
              <Pressable onPress={() => hapticTap()} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#1a1a1a' }}>{brand}</Text>
                <CaretRight size={14} color="#1a1a1a" weight="bold" />
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 6, borderRadius: radii.chip }}>
            <CheckCircle size={14} color="#2e7d32" weight="fill" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#2e7d32' }}>Verified product</Text>
          </View>
        </View>

        {rating != null ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.gold }}>★★★★★</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#666' }}>
              {rating.toFixed(1)} ({ratingCount >= 1000 ? `${(ratingCount / 1000).toFixed(1)}K` : ratingCount} owners)
            </Text>
            {buyAgain != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.chip }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#2e7d32' }}>{buyAgain}% would buy again</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {summary ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: '#444', lineHeight: 20 }} numberOfLines={3}>{summary}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {pills.map((p) => (
            <View key={p} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.chip, backgroundColor: '#ebe7df' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#555' }}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <SpecCell icon={Package} label="Storage" value={storage} />
          <SpecCell icon={DeviceMobile} label="Display" value={display} />
          <SpecCell icon={Camera} label="Main Camera" value={camera} />
          <SpecCell icon={Lightning} label="Battery Life" value={battery} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#fff3e0', padding: 12, borderRadius: radii.card, alignItems: 'flex-start' }}>
          <ShieldCheck size={22} color="#e65100" weight="fill" />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: '#5d4037', lineHeight: 18 }}>
            First, let&apos;s confirm the product. This screen shows key details to make sure you&apos;ve found the exact product before we Unmask it.
          </Text>
        </View>
      </View>
    </View>
  );
}

function SpecCell({ icon: Icon, label, value }: { icon: typeof DeviceMobile; label: string; value: string }) {
  return (
    <View
      style={{
        width: '47%',
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#e0dcd4',
        borderRadius: radii.card,
        padding: 12,
        gap: 6,
      }}
    >
      <Icon size={18} color={MAROON} weight="duotone" />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#1a1a1a' }} numberOfLines={2}>{value}</Text>
    </View>
  );
}
