import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { PillTabs } from '@/components/community';
import { OwnersPane } from '@/components/product/PeoplePanes';
import { VideosPane } from '@/components/product/VideosPane';
import { colors, fonts } from '@/constants/theme';
import { deriveUnmaskBundle } from '@/lib/unmask/derive';
import { investigationComplete } from '@/lib/unmask/investigationStages';
import { hasUnmaskRevealed, markUnmaskRevealed } from '@/lib/unmask/revealSession';
import type { UnmaskTab } from '@/lib/unmask/types';
import type { JourneyClip } from '@/lib/videos';
import type { Product } from '@/lib/types';
import type { ProductProfile } from '@/lib/types';

import { AskUnmaskTab } from './AskUnmaskTab';
import { HighlightsTab } from './HighlightsTab';
import { ProductFoundView } from './ProductFoundView';
import { ReviewsTab } from './ReviewsTab';
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
  onCompare: () => void;
  onOpenSources: () => void;
  onAskCommunity: (question: string) => void;
};

const TABS: { id: UnmaskTab; label: string }[] = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'videos', label: 'Videos' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'ask', label: 'Ask' },
];

export function ProductUnmaskFlow({
  product,
  profile,
  intelLoading,
  intelError,
  onRetryIntel,
  clipsLoading,
  clips,
  scanPhoto,
  onCompare,
  onOpenSources,
  onAskCommunity,
}: Props) {
  const [phase, setPhase] = useState<FlowPhase>(() => (hasUnmaskRevealed(product.id) ? 'unmasked' : 'found'));
  const [tab, setTab] = useState<UnmaskTab>('scorecard');
  const [dimensionId, setDimensionId] = useState<string | null>(null);

  useEffect(() => {
    setPhase(hasUnmaskRevealed(product.id) ? 'unmasked' : 'found');
    setDimensionId(null);
    setTab('scorecard');
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
    markUnmaskRevealed(product.id);
    if (investigationComplete(intelLoading, profile)) setPhase('unmasked');
    else setPhase('investigating');
  };

  if (phase === 'found') {
    return (
      <ProductFoundView
        product={product}
        profile={profile}
        onUnmask={startUnmask}
        onCompare={onCompare}
        onExplore={(section) => {
          startUnmask();
          if (section === 'videos') setTab('videos');
          else if (section === 'reviews') setTab('reviews');
          else setTab('scorecard');
        }}
      />
    );
  }

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

  if (!profile || !bundle) {
    return (
      <View style={{ paddingVertical: 40 }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone2, textAlign: 'center' }}>
          Still loading research…
        </Text>
      </View>
    );
  }

  const pane = (() => {
    if (dimensionId && tab === 'scorecard') {
      return (
        <DimensionDetail profile={profile} bundle={bundle} dimensionId={dimensionId} onBack={() => setDimensionId(null)} />
      );
    }
    switch (tab) {
      case 'scorecard':
        return (
          <ScorecardTab
            profile={profile}
            bundle={bundle}
            onDimension={(id) => setDimensionId(id)}
            onOpenSources={onOpenSources}
          />
        );
      case 'highlights':
        return <HighlightsTab bundle={bundle} onDimension={(id) => { setTab('scorecard'); setDimensionId(id); }} />;
      case 'videos':
        return (
          <VideosPane
            product={{ id: product.id, name: profile.identity.name || product.name, brand: product.brand, category: product.category }}
            clips={clips}
            loading={clipsLoading}
          />
        );
      case 'reviews':
        return profile.voices?.length ? <ReviewsTab profile={profile} /> : <OwnersPane profile={profile} />;
      case 'ask':
        return <AskUnmaskTab profile={profile} bundle={bundle} onAskCommunity={onAskCommunity} />;
    }
  })();

  return (
    <View style={{ gap: 12 }}>
      <PillTabs
        options={TABS.map((t) => ({ id: t.id, label: t.label }))}
        value={tab}
        onChange={(id) => {
          setTab(id as UnmaskTab);
          setDimensionId(null);
        }}
      />
      <View style={{ paddingBottom: 8 }}>{pane}</View>
    </View>
  );
}
