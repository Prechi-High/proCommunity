import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRight } from '@/components/icons';
import { PrimaryButton } from '@/components/kit';

import { ProductStoryOverview } from './ProductStoryOverview';
import { contractSectionForTab, RenderContractSection } from '@/components/product-result/renderContractSection';
import { EvidenceListSection, VideoGroupsSection } from '@/components/product-result/renderers/registry';
import { getUIContract } from '@/lib/product-result/contract';
import { dynamicProductUiEnabled } from '@/lib/product-result/flags';
import { DynamicFactPane } from '@/components/product/DynamicFactPane';
import { SpecsPane } from '@/components/product/Panes';
import { factSectionForTab, isFactTab } from '@/lib/unmask/presentation';
import { trackFactSectionViewed } from '@/lib/unmask/productAnalytics';
import { VideosPane } from '@/components/product/VideosPane';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { deriveUnmaskBundle } from '@/lib/unmask/derive';
import type { UnmaskTab } from '@/lib/unmask/types';
import type { ProductPreviewResponse, UnmaskJobProgress } from '@/lib/products';
import type { Product, ProductProfile } from '@/lib/types';
import type { JourneyClip } from '@/lib/videos';

import { AskUnmaskTab } from './AskUnmaskTab';
import { DimensionDetail, ScorecardTab } from './ScorecardTab';

const MAROON = '#6B0F1A';

export type IdentifyFooterActions = {
  onUnmask: () => void;
  onViewSpecs: () => void;
};

type Props = {
  product: Product;
  profile: ProductProfile | null;
  preview?: ProductPreviewResponse | null;
  intelReady?: boolean;
  jobProgress?: UnmaskJobProgress | null;
  previewLoading?: boolean;
  intelLoading: boolean;
  intelError?: boolean;
  onUnmaskPressed?: () => void;
  onRetryIntel?: () => void;
  clipsLoading: boolean;
  clips: JourneyClip[];
  scanPhoto?: string | null;
  photoUrls: string[];
  tab: UnmaskTab;
  onTabChange: (tab: UnmaskTab) => void;
  onCompare: () => void;
  onOpenSources: () => void;
  onAskCommunity: (question: string) => void;
  onOpenPrices?: () => void;
  onIdentifyFooter?: (visible: boolean, actions: IdentifyFooterActions | null) => void;
};

export function ProductUnmaskFlow({
  product,
  profile,
  preview,
  intelReady = false,
  jobProgress,
  previewLoading = false,
  intelLoading,
  intelError,
  onUnmaskPressed,
  onRetryIntel,
  clipsLoading,
  clips,
  scanPhoto,
  photoUrls,
  tab,
  onTabChange,
  onCompare,
  onOpenSources,
  onAskCommunity,
  onOpenPrices,
  onIdentifyFooter,
}: Props) {
  const [dimensionId, setDimensionId] = useState<string | null>(null);
  const bundle = useMemo(() => (profile ? deriveUnmaskBundle(profile) : null), [profile]);
  const uiContract = profile && dynamicProductUiEnabled() ? getUIContract(profile) : null;
  const trackedFactTab = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || !isFactTab(tab)) return;
    if (trackedFactTab.current === tab) return;
    trackedFactTab.current = tab;
    trackFactSectionViewed(profile, product.id, tab);
  }, [tab, profile, product.id]);

  useEffect(() => { onIdentifyFooter?.(false, null); }, [product.id]);

  if (tab === 'specs' || isFactTab(tab)) {
    if (!profile) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    if (uiContract && contractSectionForTab(uiContract, tab)) {
      return <RenderContractSection contract={uiContract} tab={tab} />;
    }
    const section = factSectionForTab(profile, tab);
    if (section?.fields.length) {
      return <DynamicFactPane section={section} fallbackTitle={section.title} />;
    }
    if (tab === 'specs' || tab === 'product_details' || tab === 'details') {
      return <SpecsPane profile={profile} onAlternative={() => {}} />;
    }
    return <DynamicFactPane section={section} />;
  }

  if (tab === 'videos') {
    const videoSection = uiContract?.sections.find((s) => s.key === 'videos' && s.enabled);
    if (videoSection) {
      return (
        <VideoGroupsSection
          section={videoSection}
          product={product}
          clips={clips}
          loading={clipsLoading}
        />
      );
    }
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
    return (
      <AskUnmaskTab
        profile={profile}
        bundle={bundle}
        onAskCommunity={onAskCommunity}
        sectionKey={tab}
        dimensionKey={dimensionId}
        uiContract={uiContract}
      />
    );
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
    const evidenceSection = uiContract?.sections.find((s) => s.key === 'evidence' && s.enabled);
    if (evidenceSection) {
      return (
        <EvidenceListSection
          section={evidenceSection}
          profile={profile}
          bundle={bundle}
          filterDimensionKey={dimensionId}
          onDimension={(id) => setDimensionId(id)}
          onOpenSources={onOpenSources}
        />
      );
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

  if (!profile || !bundle) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={colors.hi} />
      </View>
    );
  }

  return <ProductStoryOverview key={product.id} product={product} profile={profile} bundle={bundle} photos={photoUrls} onTabChange={onTabChange} onCompare={onCompare} onOpenSources={onOpenSources} onOpenPrices={onOpenPrices} onDimension={(id) => { onTabChange('evidence'); setDimensionId(id); }} />;
}

/** Fixed bottom CTA for the identify screen (rendered outside the scroll view). */
export function ProductIdentifyFloatingFooter({
  visible,
  onUnmask,
  onViewSpecs,
}: {
  visible: boolean;
  onUnmask: () => void;
  onViewSpecs: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 10),
        backgroundColor: 'rgba(249,246,240,0.96)',
        borderTopWidth: 1,
        borderTopColor: '#e8e4dc',
        gap: 8,
      }}
    >
      <Pressable onPress={onUnmask} accessibilityRole="button">
        <LinearGradient
          colors={[MAROON, '#4a0a12']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 16,
            borderRadius: radii.button,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>Unmask this product</Text>
          <ArrowRight size={18} color={colors.white} weight="bold" />
        </LinearGradient>
      </Pressable>
      <Pressable
        onPress={() => {
          hapticTap();
          onViewSpecs();
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 12,
          borderRadius: radii.button,
          borderWidth: 1.5,
          borderColor: MAROON,
        }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: MAROON }}>View Specs</Text>
      </Pressable>
    </View>
  );
}
