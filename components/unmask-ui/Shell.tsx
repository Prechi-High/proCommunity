import { MainNav } from "./MainNav";
import { type ReactNode, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, Sparkle } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";

export function AppShell({ children, title, serif, subtitle, back, notify, footer, scroll = true, flush, navigation, scrollResetKey }: {
  children: ReactNode; title?: string; serif?: boolean; subtitle?: string; back?: boolean; notify?: boolean;
  footer?: ReactNode; scroll?: boolean; flush?: boolean; navigation?: boolean; scrollResetKey?: string | number;
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { if (scrollResetKey !== undefined) scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [scrollResetKey]);
  const header = (
    <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: title ? 12 : 8, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.wine }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46 }}>
        {back ? (
          <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}>
            <ArrowLeft size={21} color={colors.ink} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="link" accessibilityLabel="Unmask home" onPress={() => router.replace("/")} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
              <Sparkle size={16} color="#F5E9C6" />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.8 }}>unmask<Text style={{ color: colors.brand }}>.</Text></Text>
          </Pressable>
        )}
        {notify ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/notifications")} style={{ minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.stage, borderWidth: 1, borderColor: colors.line }}>
            <Bell size={20} color={colors.inkSoft} />
          </Pressable>
        ) : <View style={{ width: 42 }} />}
      </View>
      {title ? (
        <View style={{ gap: 5, paddingTop: 10 }}>
          <Text accessibilityRole="header" style={{ fontFamily: serif ? fonts.serifBold : fonts.semibold, fontSize: serif ? 32 : 23, lineHeight: serif ? 38 : 30, color: colors.ink, letterSpacing: -0.65 }}>{title}</Text>
          {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft }}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, width: "100%", maxWidth: 780, alignSelf: "center", backgroundColor: colors.wine }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header}
        {scroll ? (
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: flush ? 0 : 22, paddingTop: 14, paddingBottom: footer ? 32 : 116, gap: flush ? 0 : 22, flexGrow: 1 }}>
            {children}
          </ScrollView>
        ) : <View style={{ flex: 1, paddingHorizontal: flush ? 0 : 22 }}>{children}</View>}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "web" ? 16 : 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.wine }}>{footer}</View> : null}
      </KeyboardAvoidingView>
      {navigation ? <MainNav /> : null}
    </SafeAreaView>
  );
}
