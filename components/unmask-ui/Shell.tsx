import { MainNav } from "./MainNav";
import { type ReactNode, useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ArrowLeft, Bell, Sparkle } from "@/components/icons";
import { AmbientCanvas } from "@/components/lively";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { colors, fonts, glass } from "@/constants/theme";
import type { LivelyGradientKey } from "@/constants/design-language";
import { useUnmaskTheme } from "@/lib/useUnmaskTheme";

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
  ambient = "page",
  brandSubtitle,
  homeProfile,
}: {
  children: ReactNode;
  title?: string;
  serif?: boolean;
  subtitle?: string;
  back?: boolean;
  notify?: boolean;
  /** Tagline under the Unmask wordmark when this screen has no title. */
  brandSubtitle?: string;
  /** Show profile avatar beside notifications on home. */
  homeProfile?: { id?: string; name?: string };
  footer?: ReactNode;
  scroll?: boolean;
  flush?: boolean;
  navigation?: boolean;
  scrollResetKey?: string | number;
  /** Background wash — `social` on Community-heavy screens */
  ambient?: LivelyGradientKey;
}) {
  const theme = useUnmaskTheme();
  const scheme = useColorScheme();
  const systemDark =
    scheme === "dark" ||
    (Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const dark = theme.themeMode === "dark" || (theme.themeMode === "system" && systemDark);
  const wash: LivelyGradientKey = dark ? (ambient === "cinema" ? "cinema" : "socialNight") : "page";
  const night = dark;
  const ink = night ? "#FFF8F4" : colors.ink;
  const inkSoft = night ? "rgba(255,248,244,0.72)" : colors.inkSoft;
  const word = night ? "#FFF8F4" : colors.brandDeep;
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
            <ArrowLeft size={22} color={ink} />
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
                color: word,
                letterSpacing: -1,
              }}
            >
              Unmask
            </Text>
          </Pressable>
        )}
        {notify ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push("/notifications")}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                backgroundColor: night ? "rgba(255,255,255,0.12)" : glass.fill,
                borderWidth: 1,
                borderColor: night ? "rgba(255,255,255,0.2)" : glass.strokeMuted,
              }}
            >
              <Bell size={22} color={ink} />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 4,
                  backgroundColor: "#FF6B9D",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: "#1A0A14" }}>3</Text>
              </View>
            </Pressable>
            {homeProfile ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push("/you")}>
                <PersonAvatar id={homeProfile.id} name={homeProfile.name} size={40} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
      {!title && brandSubtitle ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            lineHeight: 18,
            color: inkSoft,
            paddingTop: 2,
            paddingBottom: 4,
          }}
        >
          {brandSubtitle}
        </Text>
      ) : null}
      {title ? (
        <View style={{ gap: 6, paddingTop: 8, paddingBottom: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: serif ? fonts.serifBold : fonts.semibold,
              fontSize: serif ? 32 : 22,
              lineHeight: serif ? 36 : 28,
              color: ink,
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
                color: inkSoft,
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
        backgroundColor: colors.mist,
      }}
      edges={["top"]}
    >
      <AmbientCanvas variant={wash}>
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
      </AmbientCanvas>
    </SafeAreaView>
  );
}
