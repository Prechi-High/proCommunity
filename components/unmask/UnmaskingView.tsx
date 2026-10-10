import { Image, Text, View } from 'react-native';

import { UnmaskingLoader } from '@/components/brand/UnmaskingLoader';
import { ChatTeardropText, MagnifyingGlass, Play, Scales, Sparkle, UsersThree } from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { investigationSteps } from '@/lib/unmask/investigationStages';
import type { Product, ProductProfile } from '@/lib/types';

const STEP_ICONS: Record<string, typeof Play> = {
  experiences: ChatTeardropText,
  videos: Play,
  patterns: UsersThree,
  disagree: Scales,
  surprises: Sparkle,
};

type Props = {
  product: Product;
  profile: ProductProfile | null;
  loading: boolean;
  clipsLoading: boolean;
  clipsCount: number;
  photoUri?: string | null;
};

export function UnmaskingView({ product, profile, loading, clipsLoading, clipsCount, photoUri }: Props) {
  const name = profile?.identity.name || product.name;
  const steps = investigationSteps({ loading, profile, clipsLoading, clipsCount });

  return (
    <View style={{ gap: 20, paddingTop: 8, paddingBottom: 24, backgroundColor: colors.brandDeep, borderRadius: radii.card, padding: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radii.card, padding: 12 }}>
        <ProductImage uri={product.heroImageUrl} category={product.category} size={56} radius={12} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 17, color: colors.white }} numberOfLines={2}>{name}</Text>
          {profile?.identity.brand ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{profile.identity.brand}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 12 }}>
        {photoUri ? (
          <View style={{ width: 160, height: 160, borderRadius: 80, overflow: 'hidden' }}>
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={absFill({ backgroundColor: 'rgba(61,15,21,0.55)' })} />
            <View style={absFill({ alignItems: 'center', justifyContent: 'center' })}>
              <UnmaskingLoader size={100} />
            </View>
          </View>
        ) : (
          <UnmaskingLoader size={120} />
        )}
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: colors.white, textAlign: 'center' }}>Unmasking</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>{name}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.gold, textAlign: 'center' }}>Searching real owner experiences…</Text>
      </View>

      <View style={{ gap: 10 }}>
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id] ?? MagnifyingGlass;
          const done = step.status === 'done';
          const active = step.status === 'active';
          return (
            <View key={step.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: step.status === 'pending' ? 0.5 : 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} color={done ? colors.gold : colors.white} weight="bold" />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.white }}>{step.title}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: done ? colors.gold : active ? colors.gold : 'rgba(255,255,255,0.35)' }}>
                {done ? '✓' : active ? '◐' : '○'}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={{
          borderRadius: radii.card,
          borderWidth: 1,
          borderColor: 'rgba(255,120,140,0.45)',
          backgroundColor: 'rgba(0,0,0,0.2)',
          padding: 16,
          gap: 8,
        }}
      >
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
          This usually takes 20–40 seconds. We&apos;re building your answer from multiple sources to give you a balanced and reliable view.
        </Text>
      </View>
    </View>
  );
}

function absFill(extra: object) {
  return { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, ...extra };
}
