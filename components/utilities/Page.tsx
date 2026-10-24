import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BottomNav,
  Header,
  Heading,
  Copy,
  Button,
  s,
} from "@/components/unmask/reference/ui";
export function UtilityPage({
  title,
  sub,
  children,
  hideNav = false,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  hideNav?: boolean;
}) {
  const r = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Header onBack={() => (r.canGoBack() ? r.back() : r.replace("/you"))} />
        <Copy small>YOUR UNMASK</Copy>
        <Heading hero>{title}</Heading>
        {sub ? <Copy muted>{sub}</Copy> : null}
        {children}
      </ScrollView>
      {hideNav ? null : <BottomNav selected="You" />}
    </SafeAreaView>
  );
}
export function SignInCard() {
  const r = useRouter();
  return (
    <>
      <Copy>Sign in to view your private account information.</Copy>
      <Button label="Sign in" onPress={() => r.push("/(auth)/sign-in")} />
    </>
  );
}
