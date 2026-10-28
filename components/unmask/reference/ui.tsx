import { hapticSelect } from "@/lib/haptics";
import { MediaFrame } from "@/components/unmask-ui/MediaFrame";
import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { MainNav } from "@/components/unmask-ui/MainNav";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import {
  ArrowLeft,
  CaretRight,
  House,
  MagnifyingGlass,
  Package,
  User,
  UsersThree,
  Info,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import type { Product, ProductProfile } from "@/lib/types";

// White surfaces are intentional. Only the accent is inherited from the app brand.
export const ink = {
  brand: colors.brand,
  deep: colors.brandDeep,
  text: colors.ink,
  muted: colors.inkSoft,
  line: colors.line,
  white: "#FFFFFF",
  soft: "#F6F3F1",
  tint: "#F7F4F5",
  amber: "#8A520A",
};
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFFFF" },
  content: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: ink.line,
    borderRadius: 24,
    backgroundColor: "#FBF9F7",
    padding: 20,
    gap: 15,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 37,
    color: ink.text,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: fonts.serifBold,
    fontSize: 21,
    lineHeight: 28,
    color: ink.text,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    color: ink.text,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ink.muted,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 1,
    color: ink.brand,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    color: ink.text,
    backgroundColor: "#F8F5F2",
    borderWidth: 1,
    borderColor: ink.line,
    borderRadius: 16,
    padding: 14,
    minHeight: 52,
  },
  rule: { height: 1, backgroundColor: ink.line },
});
export function Copy({
  children,
  small = false,
  muted = false,
}: {
  children: ReactNode;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <Text style={[small ? s.small : s.body, muted && { color: ink.muted }]}>
      {children}
    </Text>
  );
}
export function Heading({
  children,
  hero = false,
}: {
  children: ReactNode;
  hero?: boolean;
}) {
  return <Text style={hero ? s.title : s.heading}>{children}</Text>;
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Pill({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: warning ? "#FFF5E7" : ink.soft,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 99,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 11,
          color: warning ? ink.amber : ink.brand,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Button({
  label,
  onPress,
  quiet = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { hapticSelect(); onPress(); }}
      style={({ pressed }) => [
        {
          minHeight: 52,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: "transparent",
          backgroundColor: quiet ? "#EEE8E5" : ink.deep,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 15,
          color: quiet ? ink.text : "#FFFFFF",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 7 }}
    >
      {options.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: value === v }}
          onPress={() => { hapticSelect(); onChange(v); }}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "transparent",
            borderRadius: 99,
            backgroundColor: value === v ? ink.deep : ink.soft,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: value === v ? "#FFFFFF" : ink.text,
            }}
          >
            {v}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Header({
  onBack,
  right,
  wordmarkLarge = false,
}: {
  onBack?: () => void;
  right?: ReactNode;
  wordmarkLarge?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        width: "100%",
        maxWidth: 780,
        alignSelf: "center",
        minHeight: 54,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ width: 44 }}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={onBack}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <ArrowLeft size={25} color={ink.text} />
          </Pressable>
        ) : null}
      </View>
      <Text
        accessibilityLabel="Unmask"
        style={{
          flex: 1,
          textAlign: "center",
          color: ink.deep,
          fontFamily: fonts.semibold,
          fontSize: wordmarkLarge ? 45 : 30,
          lineHeight: wordmarkLarge ? 54 : 40,
        }}
      >
        Unmask
      </Text>
      <View style={{ minWidth: 44, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
export function BottomNav({
  community = false,
  selected,
}: {
  community?: boolean;
  selected?: "Today" | "My Products" | "Unmask" | "Community" | "You";
}) {
  return <MainNav />;
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        padding: 13,
        borderRadius: 18,
        backgroundColor: ink.soft,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Info size={20} color={ink.brand} />
      <View style={{ flex: 1 }}>
        <Copy small>{children}</Copy>
      </View>
    </View>
  );
}
export function LinkRow({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.card, s.row, { paddingVertical: 13 }]}
    >
      {icon}
      <Text
        style={[
          s.body,
          { flex: 1, color: ink.text, fontFamily: fonts.medium },
        ]}
      >
        {label}
      </Text>
      <CaretRight size={19} color={ink.brand} />
    </Pressable>
  );
}
export function Busy({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  if (loading)
    return (
      <View style={{ paddingVertical: 12, width: "100%" }}>
        <ContentSkeleton />
      </View>
    );
  if (error) return (
    <View style={{ gap: 10 }}>
      <Notice>We couldn’t load this information. Your connection may have dropped.</Notice>
      {retry ? <Button quiet label="Try again" onPress={retry} /> : null}
    </View>
  );
  return null;
}
export function Photo({
  uri,
  size = 90,
}: {
  uri?: string | null;
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <MediaFrame uri={uri} label="Product photo" ratio={1} corners={false} />
    </View>
  );
}

export function identityLine(
  product: Product,
  profile?: ProductProfile | null,
) {
  const market = profile?.specs.find((x) =>
    /market|country|region/i.test(x.label),
  )?.value;
  return [
    product.brand || profile?.identity.brand,
    profile?.identity.size,
    market,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function Identity({
  product,
  profile,
  attached = false,
}: {
  product: Product;
  profile?: ProductProfile | null;
  attached?: boolean;
}) {
  return (
    <View style={[s.row, { paddingVertical: 10 }]}>
      <Photo uri={product.heroImageUrl || profile?.images?.[0]} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={{
            fontFamily: fonts.serifBold,
            fontSize: 23,
            lineHeight: 28,
            color: ink.text,
          }}
        >
          {product.name}
        </Text>
        <Copy muted>{identityLine(product, profile) || product.category}</Copy>
        {attached ? <Pill>Product attached</Pill> : null}
      </View>
    </View>
  );
}
export function Field({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLength,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkSoft}
      multiline={multiline}
      maxLength={maxLength}
      style={[
        s.input,
        multiline && { minHeight: 120, textAlignVertical: "top" },
      ]}
    />
  );
}
export function openSource(url?: string | null) {
  if (url && /^https?:\/\//i.test(url)) void Linking.openURL(url);
}
