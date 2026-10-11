import { Text, View } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';
import type { ProductSectionUI } from '@/lib/product-result/contract';

export function UnsupportedSectionFallback({ section }: { section: ProductSectionUI }) {
  return (
    <View style={{ padding: 20, gap: 8, backgroundColor: colors.lac, borderRadius: radii.card }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{section.title}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, lineHeight: 20 }}>
        This section isn&apos;t available in this app version yet.
      </Text>
    </View>
  );
}
