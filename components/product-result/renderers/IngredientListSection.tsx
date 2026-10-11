import { Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { ProductSectionUI } from '@/lib/product-result/contract';

export function IngredientListSection({ section }: { section: ProductSectionUI }) {
  const fields = ((section.data as { fields?: { value: string }[] })?.fields ?? []).map((f) => f.value).filter(Boolean);
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>{section.title}</Text>
      {fields.length ? (
        fields.map((line, i) => (
          <Text key={i} style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, lineHeight: 20 }}>{line}</Text>
        ))
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Ingredient details are still being collected.</Text>
      )}
    </View>
  );
}
