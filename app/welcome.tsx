import { useEffect } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ActionButton, AppShell, ClarityLayers } from "@/components/unmask-ui";
import { DiscoveryHero } from "@/components/unmask-ui/Discovery";
import { ArrowRight, ShieldCheck } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { currentSignIn } from "@/lib/auth";
import { markEntrySeen } from "@/lib/entry/api";
export default function Welcome() {
  const r = useRouter();
  useEffect(() => {
    let active = true;
    void currentSignIn()
      .then((s) => {
        if (active && s) r.replace("/(tabs)");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [r]);
  const go = async (path: string) => {
    await markEntrySeen().catch(() => undefined);
    r.replace(path as Href);
  };
  return (
    <AppShell flush>
      <View style={{ gap: 24, paddingTop: 16 }}>
        <DiscoveryHero />
        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 23,
              lineHeight: 29,
              color: colors.ink,
            }}
          >
            Your experience matters here.
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 16,
              lineHeight: 24,
              color: colors.inkSoft,
            }}
          >
            Ask before you buy. Share after you try. When a story needs more
            answers, let’s take it further.
          </Text>
          <ClarityLayers />
          <ActionButton
            label="Explore Unmask"
            icon={<ArrowRight size={20} color="#fff" />}
            onPress={() => void go("/(tabs)")}
          />
          <ActionButton
            label="Join the community"
            tone="secondary"
            onPress={() => void go("/sign-up")}
          />
          <ActionButton
            label="Already an Unmasker? Sign in"
            tone="ghost"
            onPress={() => void go("/(auth)/sign-in")}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingTop: 4,
            }}
          >
            <ShieldCheck size={18} color={colors.sage} />
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13,
                color: colors.inkSoft,
              }}
            >
              Free to explore. Your private updates stay private.
            </Text>
          </View>
        </View>
      </View>
    </AppShell>
  );
}
