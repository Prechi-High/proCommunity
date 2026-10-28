import type { ReactNode } from "react";
import { AppShell } from "@/components/unmask-ui";
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
  return <AppShell back={!root} navigation={!root} title={title} subtitle={sub}>{children}</AppShell>;
}
