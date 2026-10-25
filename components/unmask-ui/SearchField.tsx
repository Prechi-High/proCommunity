import { Pressable, TextInput, View } from "react-native";

import { MagnifyingGlass, X, Camera, ArrowRight } from "@/components/icons";
import { colors, fonts, radii } from "@/constants/theme";

export function SearchField({
  value,
  onChange,
  onSubmit,
  onCamera,
  placeholder = "Name a product. See what people lived.",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  onCamera?: () => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 54,
        borderRadius: radii.search,
        backgroundColor: "#F7F3EF",
        borderWidth: 1,
        borderColor: colors.line,
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
      {value && onSubmit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search products"
          onPress={onSubmit}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.brandDeep,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowRight size={20} color="#fff" />
        </Pressable>
      ) : onCamera ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find a product with a photo"
          onPress={onCamera}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Camera size={23} color={colors.brand} />
        </Pressable>
      ) : null}
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChange("")}
          hitSlop={8}
        >
          <X size={16} color={colors.bone3} />
        </Pressable>
      ) : null}
    </View>
  );
}
