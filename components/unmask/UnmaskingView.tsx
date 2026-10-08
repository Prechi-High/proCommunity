import { Image, Text, View } from 'react-native';

import { FocusFrame } from '@/components/brand/FocusFrame';
import { ChatTeardropText, MagnifyingGlass, Play, UsersThree } from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { investigationSteps } from '@/lib/unmask/investigationStages';
import type { Product } from '@/lib/types';
import type { ProductProfile } from '@/lib/types';

const STEP_ICONS: Record<string, typeof Play> = {
  experiences: ChatTeardropText,
  videos: Play,
  patterns: UsersThree,
  disagree: UsersThree,
  surprises: MagnifyingGlass,
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
    <View style={{ flex: 1, gap: 24, paddingTop: 8 }}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        {photoUri ? (
          <View style={{ width: 200, height: 200, borderRadius: 100, overflow: 'hidden' }}>
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ ...StyleSheetAbsolute, backgroundColor: 'rgba(246,244,239,0.55)' }} />
            <View style={{ ...StyleSheetAbsolute, alignItems: 'center', justifyContent: 'center' }}>
              <FocusFrame size={120} />
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <ProductImage uri={product.heroImageUrl} category={product.category} size={120} radius={60} />
            <FocusFrame size={100} />
          </View>
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.6, color: colors.bone, textAlign: 'center' }}>
          Unmasking{' '}
          <Text style={{ color: colors.hi }}>{name.length > 22 ? `${name.slice(0, 22)}…` : name}</Text>
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2, textAlign: 'center', paddingHorizontal: 12 }}>
          Analysing real owner experiences, videos, and discussions — only showing stages we can back with data.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id] ?? MagnifyingGlass;
          const active = step.status === 'active';
          const done = step.status === 'done';
          return (
            <View
              key={step.id}
              style={{
                borderRadius: radii.card,
                backgroundColor: colors.lac,
                borderWidth: 1,
                borderColor: active ? colors.hi : colors.line,
                padding: 14,
                gap: 8,
                opacity: step.status === 'pending' ? 0.65 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: done ? colors.sageSoft : active ? colors.hiSoft : colors.lac2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={done ? colors.sage : colors.hi} weight="bold" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{step.title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone2 }}>{step.detail}</Text>
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: done ? colors.sage : colors.bone3 }}>
                  {done ? '✓' : active ? '…' : ''}
                </Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.round(step.progress * 100)}%`,
                    height: '100%',
                    backgroundColor: done ? colors.sage : colors.hi,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ borderRadius: radii.card, backgroundColor: colors.hiSoft, padding: 16, gap: 6 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hiInk }}>Almost there…</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.bone2 }}>
          Uncovering what real owners love, question, and wish they knew sooner — with sources attached.
        </Text>
      </View>
    </View>
  );
}

const StyleSheetAbsolute = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
