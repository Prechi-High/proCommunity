import type { ReactNode } from "react";
import { Pressable, ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Header,
  Heading,
  Copy,
  BottomNav,
  s,
  ink,
} from "@/components/unmask/reference/ui";
import { Bell } from "@/components/icons";
import { useAppStore } from "@/lib/store";
export function TodayPage({
  title,
  sub,
  children,
  root = false,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  root?: boolean;
}) {
  const r = useRouter();
  const name = useAppStore((s) => s.profile?.displayName);
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Header
          onBack={
            root ? undefined : () => (r.canGoBack() ? r.back() : r.replace("/"))
          }
          right={
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                onPress={() => r.push("/notifications")}
                style={{ padding: 10 }}
              >
                <Bell size={23} color={ink.text} />
              </Pressable>
              {root ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Your profile"
                  onPress={() => r.push("/you")}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: ink.tint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: ink.brand, fontSize: 18 }}>
                    {name?.slice(0, 1) || "You"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
        <Heading hero>{title}</Heading>
        <Copy muted>{sub}</Copy>
        {children}
      </ScrollView>
      {root ? null : <BottomNav selected="Today" />}
    </SafeAreaView>
  );
}
