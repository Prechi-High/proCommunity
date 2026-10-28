import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { AppShell } from "@/components/unmask-ui";
import { Copy, Button } from "@/components/unmask/reference/ui";
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
  return <AppShell back navigation={!hideNav} title={title} subtitle={sub}>{children}</AppShell>;
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
