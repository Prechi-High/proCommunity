import { Text, View } from 'react-native';

import { ScorecardTab } from '@/components/unmask/ScorecardTab';
import { colors, fonts } from '@/constants/theme';
import type { ProductSectionUI } from '@/lib/product-result/contract';
import type { UnmaskBundle } from '@/lib/unmask/types';
import type { ProductProfile } from '@/lib/types';

type Filter = { key: string; label: string };

export function EvidenceListSection({
  section,
  profile,
  bundle,
  filterDimensionKey,
  onDimension,
  onOpenSources,
}: {
  section: ProductSectionUI;
  profile: ProductProfile;
  bundle: UnmaskBundle;
  filterDimensionKey?: string | null;
  onDimension: (id: string) => void;
  onOpenSources: () => void;
}) {
  const filters = ((section.data as { dimension_filters?: Filter[] })?.dimension_filters ?? []).filter((f) => f.label);
  const dims = filterDimensionKey
    ? bundle.dimensions.filter((d) => d.id === filterDimensionKey)
    : bundle.dimensions;

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>{section.title}</Text>
      {filters.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {filters.map((f) => (
            <Text
              key={f.key}
              style={{
                fontFamily: fonts.medium,
                fontSize: 12,
                color: filterDimensionKey === f.key ? colors.hi : colors.bone2,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              {f.label}
            </Text>
          ))}
        </View>
      ) : null}
      <ScorecardTab
        profile={profile}
        bundle={{ ...bundle, dimensions: dims }}
        onDimension={onDimension}
        onOpenSources={onOpenSources}
        mode="evidence"
      />
    </View>
  );
}
