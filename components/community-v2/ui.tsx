import type { ReactNode } from "react";
import { AppShell } from "@/components/unmask-ui";
import { Copy } from "@/components/unmask/reference/ui";
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
  return <AppShell back={back} navigation title={title} subtitle={sub}>{children}</AppShell>;
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
