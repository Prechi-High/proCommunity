import { Text, View } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';
import type { ProductPresentation } from '@/lib/unmask/presentation';

type Props = {
  section: ProductPresentation['factSections'][number] | null;
  fallbackTitle?: string;
};

export function DynamicFactPane({ section, fallbackTitle = 'Details' }: Props) {
  if (!section || !section.fields.length) {
    return (
      <View style={{ paddingVertical: 24, gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>{fallbackTitle}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, lineHeight: 20 }}>
          We&apos;re still collecting reliable factual details for this product.
        </Text>
      </View>
    );
  }

  const ingredientList = section.renderer === 'ingredient_list';

  return (
    <View style={{ gap: 14, paddingVertical: 8 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>{section.title}</Text>
      {ingredientList ? (
        <View style={{ gap: 6 }}>
          {section.fields.map((f) => (
            <Text key={f.key} style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, lineHeight: 20 }}>
              {f.value}
            </Text>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {section.fields.map((f) => (
            <View
              key={f.key}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: radii.card,
                backgroundColor: colors.lac,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>{f.label}</Text>
              <Text style={{ flex: 1.2, fontFamily: fonts.semibold, fontSize: 14, color: colors.bone, textAlign: 'right' }}>{f.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
