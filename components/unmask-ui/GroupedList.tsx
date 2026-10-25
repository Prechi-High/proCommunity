import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CaretRight } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

export function GroupedList({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.stage, borderRadius: 18, overflow: 'hidden' }}>{children}</View>
  );
}

export function GroupedRow({
  label,
  detail,
  onPress,
  last,
  leading,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
  leading?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: 52,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}
    >
      {leading}
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink }}>{label}</Text>
      {detail ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>{detail}</Text>
      ) : null}
      <CaretRight size={16} color={colors.bone3} />
    </Pressable>
  );
}
