import { Pressable, TextInput, View } from 'react-native';

import { MagnifyingGlass, X } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = 'Name a product. See what people lived.',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        borderRadius: radii.search,
        backgroundColor: colors.mist,
        paddingHorizontal: 14,
      }}
    >
      <MagnifyingGlass size={18} color={colors.inkSoft} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.bone3}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          fontFamily: fonts.regular,
          fontSize: 16,
          lineHeight: 22,
          color: colors.ink,
          paddingVertical: 10,
        }}
      />
      {value ? (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={8}>
          <X size={16} color={colors.bone3} />
        </Pressable>
      ) : null}
    </View>
  );
}
