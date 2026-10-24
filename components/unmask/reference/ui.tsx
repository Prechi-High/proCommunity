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
  text: "#111827",
  muted: "#626B7C",
  line: "#E4E6EA",
  white: "#FFFFFF",
  soft: "#F6F7F8",
  tint: "#F7F4F5",
  amber: "#8A520A",
};
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFFFF" },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: ink.line,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    lineHeight: 33,
    color: ink.text,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: fonts.serifBold,
    fontSize: 23,
    lineHeight: 28,
    color: ink.text,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: ink.text,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
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
    fontSize: 15,
    lineHeight: 22,
    color: ink.text,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ink.line,
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
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
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          paddingVertical: 11,
          paddingHorizontal: 15,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: quiet ? ink.brand : "transparent",
          backgroundColor: quiet ? "#FFFFFF" : ink.brand,
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
          fontSize: 14,
          color: quiet ? ink.brand : "#FFFFFF",
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
          onPress={() => onChange(v)}
          style={{
            minHeight: 36,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: value === v ? ink.brand : ink.line,
            borderRadius: 99,
            backgroundColor: value === v ? ink.brand : "#FFFFFF",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 12,
              color: value === v ? "#FFFFFF" : ink.muted,
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
        maxWidth: 760,
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
          color: ink.brand,
          fontFamily: fonts.serifBold,
          fontSize: wordmarkLarge ? 45 : 30,
          lineHeight: wordmarkLarge ? 54 : 40,
        }}
      >
        unmask
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
  const r = useRouter();
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderColor: ink.line,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          flexDirection: "row",
          paddingTop: 7,
          paddingBottom: 9,
        }}
      >
        {(
          [
            { name: "Today", href: "/", Icon: House },
            { name: "My Products", href: "/products", Icon: Package },
            { name: "Unmask", href: "/unmask", Icon: MagnifyingGlass },
            { name: "Community", href: "/pulse", Icon: UsersThree },
            { name: "You", href: "/you", Icon: User },
          ] as const
        ).map(({ name, href, Icon }) => {
          const active =
            name === (selected ?? (community ? "Community" : "Unmask"));
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => r.push(href as Href)}
              style={{ flex: 1, alignItems: "center", gap: 3, minHeight: 43 }}
            >
              <Icon
                size={25}
                color={active ? ink.brand : ink.muted}
                weight={active ? "bold" : "regular"}
              />
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 10,
                  color: active ? ink.brand : ink.muted,
                }}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        padding: 13,
        borderRadius: 10,
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
          { flex: 1, color: ink.brand, fontFamily: fonts.medium },
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
      <View style={{ padding: 28, alignItems: "center" }}>
        <ActivityIndicator color={ink.brand} />
      </View>
    );
  if (error)
    return (
      <Notice>
        Unable to load this information.
        {retry ? (
          <Text onPress={retry} style={{ color: ink.brand }}>
            {" "}
            Try again
          </Text>
        ) : null}
      </Notice>
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
  return uri ? (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
      }}
      resizeMode="contain"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: ink.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Package size={32} color={ink.muted} />
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
      placeholderTextColor="#959BA5"
      multiline={multiline}
      maxLength={maxLength}
      style={[
        s.input,
        multiline && { minHeight: 80, textAlignVertical: "top" },
      ]}
    />
  );
}
export function openSource(url?: string | null) {
  if (url && /^https?:\/\//i.test(url)) void Linking.openURL(url);
}
