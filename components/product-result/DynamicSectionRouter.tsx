import { Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { ProductUIContractV1 } from '@/lib/product-result/contract';

import { DynamicOverview } from './DynamicOverview';
import { UnsupportedSectionFallback } from './UnsupportedSectionFallback';
import { rendererRegistry } from './renderers/registry';

type Props = {
  contract: ProductUIContractV1;
  activeSectionKey: string;
  evidenceFilterKey: string | null;
  onDimension: (filterKey: string) => void;
  renderEvidence: () => React.ReactNode;
  renderVideos: () => React.ReactNode;
  renderAsk: () => React.ReactNode;
};

export function DynamicSectionRouter({
  contract,
  activeSectionKey,
  onDimension,
  renderEvidence,
  renderVideos,
  renderAsk,
}: Props) {
  if (activeSectionKey === 'overview') {
    return <DynamicOverview contract={contract} onDimension={onDimension} />;
  }

  if (activeSectionKey === 'evidence') return <>{renderEvidence()}</>;
  if (activeSectionKey === 'videos') return <>{renderVideos()}</>;
  if (activeSectionKey === 'ask') return <>{renderAsk()}</>;

  const section = contract.sections.find((s) => s.key === activeSectionKey && s.enabled);
  if (!section) {
    return (
      <View style={{ paddingVertical: 24 }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center' }}>Section unavailable.</Text>
      </View>
    );
  }

  const Renderer = rendererRegistry[section.renderer];
  if (!Renderer) return <UnsupportedSectionFallback section={section} />;
  return <Renderer section={section} />;
}
