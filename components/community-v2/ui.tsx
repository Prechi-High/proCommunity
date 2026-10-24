import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Header,
  Heading,
  Copy,
  BottomNav,
  s,
} from "@/components/unmask/reference/ui";
export function CommunityPage({
  title,
  sub,
  children,
  back = true,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  back?: boolean;
}) {
  const r = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Header
          onBack={
            back
              ? () => (r.canGoBack() ? r.back() : r.replace("/pulse"))
              : undefined
          }
        />
        <Heading hero>{title}</Heading>
        {sub ? <Copy muted>{sub}</Copy> : null}
        {children}
      </ScrollView>
      <BottomNav community />
    </SafeAreaView>
  );
}

import { Field as Input } from "@/components/unmask/reference/ui";
import { View } from "react-native";
export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Copy>{label}</Copy>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={label}
        multiline={multiline}
      />
    </View>
  );
}
