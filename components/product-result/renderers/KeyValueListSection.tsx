import { Text, View } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';
import type { ProductSectionUI } from '@/lib/product-result/contract';

type Field = { key: string; label: string; value: string; unit?: string | null };

export function KeyValueListSection({ section }: { section: ProductSectionUI }) {
  const fields = ((section.data as { fields?: Field[] })?.fields ?? []).filter((f) => f.value);
  if (!fields.length) {
    return (
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
        {section.empty_state?.body ?? 'No details available yet.'}
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>{section.title}</Text>
      {fields.map((f) => (
        <View
          key={f.key}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            padding: 12,
            borderRadius: radii.card,
            backgroundColor: colors.lac,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>{f.label}</Text>
          <Text style={{ flex: 1.2, fontFamily: fonts.semibold, fontSize: 14, color: colors.bone, textAlign: 'right' }}>
            {f.value}{f.unit ? ` ${f.unit}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
