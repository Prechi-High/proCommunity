import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/kit';

import { SpecsPane } from '@/components/product/Panes';
import { VideosPane } from '@/components/product/VideosPane';
import { colors, fonts } from '@/constants/theme';
import { deriveUnmaskBundle } from '@/lib/unmask/derive';
import { investigationComplete } from '@/lib/unmask/investigationStages';
import { hasUnmaskRevealed, markUnmaskRevealed } from '@/lib/unmask/revealSession';
import type { UnmaskTab } from '@/lib/unmask/types';
import type { Product, ProductProfile } from '@/lib/types';
import type { JourneyClip } from '@/lib/videos';

import { AskUnmaskTab } from './AskUnmaskTab';
import { HighlightsTab } from './HighlightsTab';
import { ProductFoundView } from './ProductFoundView';
import { DimensionDetail, ScorecardTab } from './ScorecardTab';
import { UnmaskingView } from './UnmaskingView';

type FlowPhase = 'found' | 'investigating' | 'unmasked';

type Props = {
  product: Product;
  profile: ProductProfile | null;
  intelLoading: boolean;
  intelError?: boolean;
  onRetryIntel?: () => void;
  clipsLoading: boolean;
  clips: JourneyClip[];
  scanPhoto?: string | null;
  tab: UnmaskTab;
  onTabChange: (tab: UnmaskTab) => void;
  onCompare: () => void;
  onOpenSources: () => void;
  onAskCommunity: (question: string) => void;
  onOpenPrices?: () => void;
};

export function ProductUnmaskFlow({
  product,
  profile,
  intelLoading,
  intelError,
  onRetryIntel,
  clipsLoading,
  clips,
  scanPhoto,
  tab,
  onTabChange,
  onCompare,
  onOpenSources,
  onAskCommunity,
  onOpenPrices,
}: Props) {
  const [phase, setPhase] = useState<FlowPhase>(() => (hasUnmaskRevealed(product.id) ? 'unmasked' : 'found'));
  const [dimensionId, setDimensionId] = useState<string | null>(null);

  useEffect(() => {
    setPhase(hasUnmaskRevealed(product.id) ? 'unmasked' : 'found');
    setDimensionId(null);
  }, [product.id]);

  useEffect(() => {
    if (phase !== 'investigating') return;
    if (investigationComplete(intelLoading, profile)) {
      markUnmaskRevealed(product.id);
      setPhase('unmasked');
    }
  }, [phase, intelLoading, profile, product.id]);

  const bundle = useMemo(() => (profile ? deriveUnmaskBundle(profile) : null), [profile]);

  const startUnmask = () => {
    if (investigationComplete(intelLoading, profile)) {
      markUnmaskRevealed(product.id);
      setPhase('unmasked');
    } else setPhase('investigating');
  };

  if (phase === 'investigating') {
    if (intelError) {
      return (
        <View style={{ gap: 12, paddingVertical: 24 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone }}>Research didn&apos;t finish</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Check your connection and try again.</Text>
          {onRetryIntel ? (
            <Text onPress={onRetryIntel} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Try again</Text>
          ) : null}
        </View>
      );
    }
    return (
      <UnmaskingView
        product={product}
        profile={profile}
        loading={intelLoading}
        clipsLoading={clipsLoading}
        clipsCount={clips.length}
        photoUri={scanPhoto}
      />
    );
  }

  if (phase === 'found' && tab !== 'overview' && tab !== 'specs') {
    return (
      <View style={{ gap: 16, paddingVertical: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone2, textAlign: 'center', lineHeight: 22 }}>
          Unmask this product first to unlock {tab === 'ask' ? 'Ask' : tab.charAt(0).toUpperCase() + tab.slice(1)}.
        </Text>
        <PrimaryButton label="Unmask this product →" onPress={startUnmask} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (tab === 'specs') {
    if (!profile) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    return <SpecsPane profile={profile} onAlternative={() => {}} />;
  }

  if (tab === 'videos') {
    return (
      <VideosPane
        product={{ id: product.id, name: profile?.identity.name || product.name, brand: product.brand, category: product.category }}
        clips={clips}
        loading={clipsLoading}
      />
    );
  }

  if (tab === 'ask') {
    if (!profile || !bundle) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    return <AskUnmaskTab profile={profile} bundle={bundle} onAskCommunity={onAskCommunity} />;
  }

  if (tab === 'evidence') {
    if (!profile || !bundle) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    if (dimensionId) {
      return <DimensionDetail profile={profile} bundle={bundle} dimensionId={dimensionId} onBack={() => setDimensionId(null)} />;
    }
    return (
      <ScorecardTab
        profile={profile}
        bundle={bundle}
        onDimension={(id) => setDimensionId(id)}
        onOpenSources={onOpenSources}
        mode="evidence"
      />
    );
  }

  if (phase === 'found' || !profile || !bundle) {
    return (
      <ProductFoundView
        product={product}
        profile={profile}
        onUnmask={startUnmask}
        onCompare={onCompare}
        onOpenPrices={onOpenPrices}
        onExplore={(section) => {
          if (section === 'videos') onTabChange('videos');
          else if (section === 'evidence') onTabChange('evidence');
          else onTabChange('overview');
        }}
      />
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <ScorecardTab
        profile={profile}
        bundle={bundle}
        onDimension={(id) => {
          onTabChange('evidence');
          setDimensionId(id);
        }}
        onOpenSources={onOpenSources}
        mode="overview"
      />
      <HighlightsTab bundle={bundle} onDimension={(id) => { onTabChange('evidence'); setDimensionId(id); }} />
    </View>
  );
}
