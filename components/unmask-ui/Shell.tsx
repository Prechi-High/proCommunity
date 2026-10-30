import { MainNav } from "./MainNav";
import { type ReactNode, useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ArrowLeft, Bell, Sparkle } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";

export function AppShell({
  children,
  title,
  serif,
  subtitle,
  back,
  notify,
  footer,
  scroll = true,
  flush,
  navigation,
  scrollResetKey,
}: {
  children: ReactNode;
  title?: string;
  serif?: boolean;
  subtitle?: string;
  back?: boolean;
  notify?: boolean;
  footer?: ReactNode;
  scroll?: boolean;
  flush?: boolean;
  navigation?: boolean;
  scrollResetKey?: string | number;
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollResetKey !== undefined)
      scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollResetKey]);
  const header = (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: title ? 8 : 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 44,
        }}
      >
        {back ? (
          <Pressable
            accessibilityLabel="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Unmask home"
            onPress={() => router.replace("/")}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                backgroundColor: colors.brandDeep,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkle size={17} color="#F0D99C" />
            </View>
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 30,
                color: colors.brandDeep,
                letterSpacing: -1,
              }}
            >
              Unmask
            </Text>
          </Pressable>
        )}
        {notify ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push("/notifications")}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              backgroundColor: colors.stage,
            }}
          >
            <Bell size={22} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
      {title ? (
        <View style={{ gap: 6, paddingTop: 8, paddingBottom: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: serif ? fonts.serifBold : fonts.semibold,
              fontSize: serif ? 32 : 22,
              lineHeight: serif ? 36 : 28,
              color: colors.ink,
              letterSpacing: serif ? -0.6 : -0.2,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 15,
                lineHeight: 22,
                color: colors.inkSoft,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 780,
        alignSelf: "center",
        backgroundColor: colors.white,
      }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {header}
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: flush ? 0 : 20,
              paddingBottom: footer ? 32 : 120,
              gap: flush ? 0 : 24,
            }}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: flush ? 0 : 20 }}>
            {children}
          </View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Platform.OS === "web" ? 16 : 10,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              backgroundColor: colors.white,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {navigation ? <MainNav /> : null}
    </SafeAreaView>
  );
}
