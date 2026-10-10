import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { UnmaskingLoader } from '@/components/brand/UnmaskingLoader';
import { ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import type { Product, ProductProfile } from '@/lib/types';

const LINES = [
  'Scanning stores and listings…',
  'Matching photos and model names…',
  'Cross-checking reviews and specs…',
  'Locking onto your product…',
];

type Props = {
  product: Product;
  profile: ProductProfile | null;
};

export function ProductDiscoveringView({ product, profile }: Props) {
  const [line, setLine] = useState(0);
  const name = profile?.identity.name || product.name;

  useEffect(() => {
    const id = setInterval(() => setLine((n) => (n + 1) % LINES.length), 1400);
    return () => clearInterval(id);
  }, []);

  const hero = product.heroImageUrl || profile?.images?.[0];

  return (
    <View style={{ minHeight: 420, borderRadius: 0, overflow: 'hidden', marginHorizontal: -16 }}>
      <LinearGradient colors={['#1a0a0d', '#3D0F15', '#1a0a0d']} style={{ flex: 1, paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', gap: 20 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', borderWidth: 2, borderColor: colors.gold }}>
          {hero ? (
            <Image source={{ uri: hero }} style={{ width: '100%', height: '100%' }} blurRadius={8} />
          ) : (
            <ProductImage uri={null} category={product.category} size={120} radius={0} />
          )}
          <View style={{ ...StyleSheetAbsolute, backgroundColor: 'rgba(61,15,21,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <UnmaskingLoader size={72} />
          </View>
        </View>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 24, color: colors.white, textAlign: 'center' }}>Discovering</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }} numberOfLines={2}>{name}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.gold, textAlign: 'center' }}>{LINES[line]}</Text>
      </LinearGradient>
    </View>
  );
}

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
