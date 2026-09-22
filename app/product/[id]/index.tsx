import { useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { ThreadRow } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { ScoreBadge } from '@/components/ScoreBadge';
import { OfficialEmbed } from '@/components/VideoEmbed';
import { Caption, Chip, Disclaimer, Heading, SectionHeader } from '@/components/ui';
import { ArrowLeft, ArrowRight, ChatCircle, Heart, Play, categoryIcon } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { getLiteracyForProduct, getProductThreads, routeId, tagLabel } from '@/lib/catalog';
import {
  hapticChapterTurn,
  hapticMarked,
  hapticPresence,
  hapticSuccess,
  hapticTap,
  hapticVerdictLand,
  hapticVerdictTick,
} from '@/lib/haptics';
import { computeFitScore, loadProductCase, renderMarkedText, type ProductCaseAnalysis } from '@/lib/productCase';
import { resolvedSkinType, useAppStore } from '@/lib/store';
import { FALLBACK_TAGS, PAGE_SIZE, loadTaxonomy, type ContentTagKey } from '@/lib/taxonomy';
import type { Product, Profile, SkinType } from '@/lib/types';
import { useProduct } from '@/lib/useProduct';
import { loadJourneyForTag, voterKeyFor, type JourneyClip } from '@/lib/videos';

const CHAPTER_META = [
  { key: 'verdict' as const, label: 'The verdict' },
  { key: 'fit' as const, label: 'Confidence for you' },
  { key: 'proof' as const, label: 'The proof' },
  { key: 'people' as const, label: 'The people' },
];

export default function ProductCaseScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const profile = useAppStore((s) => s.profile);
  const guestSkin = useAppStore((s) => s.guestSkinType);
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setGuestSkin = useAppStore((s) => s.setGuestSkin);
  const [chapter, setChapter] = useState(0);
  const [proofSeg, setProofSeg] = useState<'say' | 'watch'>('say');
  const [journey, setJourney] = useState<ContentTagKey>('who_its_for');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [skin, setSkin] = useState<SkinType | null>(resolvedSkinType({ profile, guestSkinType: guestSkin }));
  const [hiOn, setHiOn] = useState(false);
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);
  const lastTick = useRef(0);
  const voterKey = voterKeyFor(profile?.id);

  // rest of file unchanged...

  return (
    <Screen scroll={false} padded={false} footer={...}>
      {/* existing content */}
    </Screen>
  );
}

function VerdictChapter({
  product,
  Icon,
  analysis,
  thin,
  loading,
  displayScore,
  hiOn,
  split,
  presenceN,
}: {
  product: Product;
  Icon: ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' }>; 
  analysis?: ProductCaseAnalysis;
  thin: boolean;
  loading: boolean;
  displayScore: number;
  hiOn: boolean;
  split: { positive: number; mixed: number; negative: number };
  presenceN: number;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>{product.brand}</Text>
          <Heading size={31} style={{ marginTop: 4 }}>{product.name}</Heading>
        </View>
        {product.heroImageUrl ? (
          <Image source={{ uri: product.heroImageUrl }} style={{ width: 54, height: 80, borderRadius: 12, backgroundColor: colors.lac }} resizeMode="cover" />
        ) : (
          <View style={{ width: 54, height: 80, borderRadius: 12, backgroundColor: colors.lac2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={colors.bone2} weight="regular" />
          </View>
        )}
      </View>

      <ScoreBadge score={analysis?.productScore ?? null} />

      {loading ? (
        <ActivityIndicator color={colors.hi} style={{ marginTop: 40 }} />
      ) : thin ? (
        <View style={{ marginTop: 26 }}>
          <Heading size={36}>Not enough to score yet.</Heading>
          <Caption color={colors.bone2}>{analysis?.basis ?? 'We found too few comments. A score from that would mislead you.'}</Caption>
        </View>
      ) : (
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
            <Text style={{ fontFamily: fonts.serif, fontWeight: '500', fontSize: 120, lineHeight: 94, letterSpacing: -5, color: colors.bone, minWidth: 100 }}>
              {displayScore}
            </Text>
            <View style={{ paddingBottom: 6, flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>Product Score</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, marginTop: 2, lineHeight: 20 }}>
                Out of 100. What everyone says.
              </Text>
            </View>
          </View>

          <Text style={{ marginTop: 22, fontFamily: fonts.serif, fontWeight: '500', fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: colors.bone }}>
            {renderMarkedText(analysis?.verdict ?? '', analysis?.verdictMarks ?? []).map((part, i) =>
              part.marked && hiOn ? (
                <Text key={i} style={{ backgroundColor: colors.hi, color: colors.wine }}>{part.text}</Text>
              ) : (
                <Text key={i}>{part.text}</Text>
              ),
            )}
          </Text>

          <View style={{ flexDirection: 'row', gap: 3, marginTop: 22, height: 12 }}>
            <View style={{ flex: Math.max(split.positive, 1), borderRadius: 6, backgroundColor: colors.sage }} />
            <View style={{ flex: Math.max(split.mixed, 1), borderRadius: 6, backgroundColor: colors.honey }} />
            <View style={{ flex: Math.max(split.negative, 1), borderRadius: 6, backgroundColor: colors.coral }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
            <LegendDot color={colors.sage} label={`Positive ${split.positive}%`} />
            <LegendDot color={colors.honey} label={`Mixed ${split.mixed}%`} />
            <LegendDot color={colors.coral} label={`Negative ${split.negative}%`} />
          </View>

          <Text style={{ marginTop: 16, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>{analysis?.basis}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 16 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Sample · {presenceN} people are reading this right now</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// rest of file unchanged
