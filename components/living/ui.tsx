import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors as c, fonts as f } from "@/constants/theme";
import { ArrowLeft, ArrowRight, Leaf, Plus } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { Wordmark } from "@/components/brand/Wordmark";
import { useAppStore } from "@/lib/store";
export const design = StyleSheet.create({
  card: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: {
    fontFamily: f.regular,
    fontSize: 15,
    lineHeight: 23,
    color: c.inkSoft,
  },
  small: {
    fontFamily: f.medium,
    fontSize: 12,
    lineHeight: 18,
    color: c.inkSoft,
  },
  title: { fontFamily: f.serif, fontSize: 30, lineHeight: 34, color: c.ink },
  label: {
    fontFamily: f.semibold,
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: c.brand,
  },
  input: {
    fontFamily: f.regular,
    fontSize: 15,
    color: c.ink,
    backgroundColor: c.white,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 48,
  },
});
export function Page({
  children,
  title,
  eyebrow,
  sub,
  back = false,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  sub?: string;
  back?: boolean;
}) {
  const r = useRouter();
  const { width } = useWindowDimensions();
  return (
    <Screen>
      <View
        style={{
          width: "100%",
          maxWidth: 1060,
          alignSelf: "center",
          paddingTop: 20,
          gap: 28,
        }}
      >
        <View style={[design.row, { justifyContent: "space-between", borderBottomWidth: 1, borderColor: c.line, paddingBottom: 20 }]}>
          {back ? (
            <Pressable
              accessibilityLabel="Back"
              onPress={() =>
                r.canGoBack() ? r.back() : r.replace("/" as Href)
              }
              style={{ padding: 8 }}
            >
              <ArrowLeft size={22} color={c.brand} />
            </Pressable>
          ) : (
            <Wordmark height={24} />
          )}
          <Tag text="SKINCARE · CHAPTER 01" />
        </View>
        <View style={{ gap: 10 }}>
          {eyebrow ? <Text style={design.label}>{eyebrow}</Text> : null}
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: f.serif,
              fontSize: width >= 760 ? 52 : 36,
              lineHeight: width >= 760 ? 56 : 41,
              color: c.ink,
              letterSpacing: -1,
            }}
          >
            {title}
          </Text>
          {sub ? (
            <Text style={[design.body, { maxWidth: 680 }]}>{sub}</Text>
          ) : null}
        </View>
        {children}
        <View style={{ height: 24 }} />
      </View>
    </Screen>
  );
}
export function Card({
  children,
  tone = "white",
}: {
  children: ReactNode;
  tone?: "white" | "wine" | "sage" | "gold";
}) {
  return (
    <View
      style={[
        design.card,
        tone === "wine"
          ? { backgroundColor: c.brand, borderColor: c.brand }
          : tone === "sage"
            ? { backgroundColor: c.sageSoft }
            : tone === "gold"
              ? { backgroundColor: c.goldSoft }
              : null,
      ]}
    >
      {children}
    </View>
  );
}
export function Title({
  children,
  action,
  onPress,
}: {
  children: ReactNode;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={[
        design.row,
        { justifyContent: "space-between", flexWrap: "wrap" },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[design.title, { flexShrink: 1 }]}
      >
        {children}
      </Text>
      {action ? (
        <Pressable onPress={onPress} accessibilityRole="button">
          <Text style={[design.small, { color: c.brand }]}>{action} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
export function Body({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Text style={[design.body, light ? { color: "#F2E7E4" } : null]}>
      {children}
    </Text>
  );
}
export function Tag({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "sage" | "gold";
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor:
          tone === "sage" ? c.sageSoft : tone === "gold" ? c.goldSoft : c.lac2,
      }}
    >
      <Text
        style={{
          fontFamily: f.semibold,
          fontSize: 10,
          letterSpacing: 0.5,
          color: tone === "sage" ? c.sage : c.brand,
        }}
      >
        {text.replace(/_/g, " ").toUpperCase()}
      </Text>
    </View>
  );
}
export function Button({
  label,
  onPress,
  quiet = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: quiet ? c.white : c.brand,
        borderWidth: 1,
        borderColor: quiet ? c.line : c.brand,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: f.semibold,
          fontSize: 13,
          color: quiet ? c.brand : c.white,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  secure?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={[design.small, { color: c.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.bone3}
        multiline={multiline}
        secureTextEntry={secure}
        style={[
          design.input,
          multiline ? { minHeight: 96, textAlignVertical: "top" } : null,
        ]}
      />
    </View>
  );
}
export function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={design.small}>{label}</Text> : null}
      <View style={[design.row, { flexWrap: "wrap", gap: 7 }]}>
        {options.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: value === o.id }}
            onPress={() => onChange(o.id)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: value === o.id ? c.brand : c.line,
              backgroundColor: value === o.id ? c.brand : c.white,
            }}
          >
            <Text
              style={{
                fontFamily: value === o.id ? f.semibold : f.regular,
                fontSize: 12,
                color: value === o.id ? c.white : c.inkSoft,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Empty({
  title,
  body,
  action,
  onPress,
}: {
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        paddingVertical: 28,
        paddingHorizontal: 18,
        gap: 12,
        alignItems: "flex-start",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.line,
        borderRadius: 18,
      }}
    >
      <Leaf size={26} color={c.brand} />
      <Text style={[design.title, { fontSize: 25 }]}>{title}</Text>
      <Body>{body}</Body>
      {action && onPress ? <Button label={action} onPress={onPress} /> : null}
    </View>
  );
}
export function ProductTile({
  name,
  brand,
  image,
  detail,
  onPress,
}: {
  name: string;
  brand?: string | null;
  image?: string | null;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        design.row,
        {
          backgroundColor: c.white,
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.line,
        },
      ]}
    >
      <View
        style={{
          width: 64,
          height: 76,
          backgroundColor: c.lac2,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: 54, height: 66 }}
            resizeMode="contain"
          />
        ) : (
          <Leaf size={25} color={c.brand} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        {brand ? <Text style={design.label}>{brand}</Text> : null}
        <Text style={{ fontFamily: f.semibold, fontSize: 15, color: c.ink }}>
          {name}
        </Text>
        {detail ? <Text style={design.small}>{detail}</Text> : null}
      </View>
      <ArrowRight size={18} color={c.brand} />
    </Pressable>
  );
}
export function Busy({
  error,
  loading,
  retry,
}: {
  error: unknown;
  loading: boolean;
  retry?: () => void;
}) {
  if (loading)
    return <ActivityIndicator color={c.brand} style={{ padding: 30 }} />;
  if (error)
    return (
      <Card>
        <Body>
          {error instanceof Error
            ? error.message
            : "Could not load this. Please try again."}
        </Body>
        {retry ? <Button quiet label="Try again" onPress={retry} /> : null}
      </Card>
    );
  return null;
}
export function useLivingQuery<T>(
  key: unknown[],
  fn: () => Promise<T>,
  enabled = true,
) {
  const uid = useAppStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ["living", uid, ...key],
    queryFn: fn,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
export function useAction() {
  const qc = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => {
      return await fn();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["living"] });
    },
  });
  return {
    ...mutation,
    run: (fn: () => Promise<unknown>) => {
      if (!useAppStore.getState().profile) {
        router.push("/(auth)/sign-in");
        return;
      }
      mutation.mutate(fn);
    },
  };
}
export function ActionStatus({
  action,
}: {
  action: ReturnType<typeof useAction>;
}) {
  return (
    <>
      {action.isPending ? <Text style={design.small}>Saving…</Text> : null}
      {action.error ? (
        <Text
          accessibilityRole="alert"
          style={[design.body, { color: c.coral }]}
        >
          {action.error.message}
        </Text>
      ) : null}
    </>
  );
}
export const visibilityOptions = [
  { id: "private", label: "Only me" },
  { id: "followers", label: "Followers" },
  { id: "public", label: "Public" },
];
export const acquisitionOptions = [
  { id: "purchased", label: "Bought myself" },
  { id: "gifted", label: "Gifted" },
  { id: "sample", label: "Sample" },
  { id: "brand_supplied", label: "Brand supplied" },
  { id: "content_exchange", label: "For content" },
  { id: "other", label: "Other" },
];
export const stateOptions = [
  "purchased",
  "active",
  "paused",
  "finished",
  "stopped",
  "replaced",
  "repurchased",
].map((id) => ({
  id,
  label: id === "purchased" ? "Not started" : id[0].toUpperCase() + id.slice(1),
}));
