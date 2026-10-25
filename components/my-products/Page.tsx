import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BottomNav,
  Header,
  Heading,
  Copy,
  s,
} from "@/components/unmask/reference/ui";
export function ProductsPage({
  title,
  sub,
  children,
  root = false,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  root?: boolean;
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
            root
              ? undefined
              : () => (r.canGoBack() ? r.back() : r.replace("/products"))
          }
        />
        <Heading hero>{title}</Heading>
        {sub ? <Copy muted>{sub}</Copy> : null}
        {children}
      </ScrollView>
      {root ? null : <BottomNav selected="My Products" />}
    </SafeAreaView>
  );
}
