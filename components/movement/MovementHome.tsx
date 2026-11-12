import { useState } from "react";
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { SearchField } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CINEMATIC_AT } from "@/lib/movement/frame";

import { CommunityWithUs } from "./CommunityWithUs";
import { First90 } from "./First90";
import { OrientationFilm } from "./OrientationFilm";
import { useMovementPalette } from "./palette";
import { MovementButton, TextLink } from "./Press";

const CODE = [
  "Ask why.",
  "Good for who?",
  "Truth needs context.",
  "Your experience is valid.",
  "Your conclusion still needs context.",
];

const HABIT = [
  { n: "01", title: "Choose one", line: "One product you are using now. Not everything you own." },
  { n: "02", title: "Document the starting point", line: "What you know today, before the story disappears." },
  { n: "03", title: "Add context", line: "Good for who? The circumstances belong with the experience." },
  { n: "04", title: "Update, then share", line: "Come back as it changes. Share when it can help someone else." },
];

const OPEN = [
  { title: "Search products", line: "Find a product and see what people have lived with it.", href: "/results" },
  { title: "Timelines", line: "A product story that stays after the first reaction.", href: "/products" },
  { title: "Experiences", line: "Share what happened. Keep what changed.", href: "/contribute" },
  { title: "Community", line: "Read with other Unmaskers. Ask before you buy.", href: "/community" },
];

export function MovementHome() {
  const palette = useMovementPalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= CINEMATIC_AT;
  const [query, setQuery] = useState("");
  const go = (href: string) => router.push(href as Href);
  const started = () => go("/sign-up");
  const oneProduct = () =>
    router.push({ pathname: "/sign-up", params: { returnTo: "/products/add" } } as Href);
  const search = () => {
    const q = query.trim();
    if (q.length > 1) router.push({ pathname: "/results", params: { q } } as Href);
  };

  const hero = (
    <View style={{ flex: 1, gap: 22, justifyContent: "center", minWidth: wide ? 360 : undefined }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.6, color: palette.gold }}>
        KNOW BEFORE YOU BUY
      </Text>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayBold, fontSize: wide ? 64 : 40, lineHeight: wide ? 70 : 48, letterSpacing: -0.8, color: palette.ink }}>
        Don’t just buy.{"\n"}Unmask.
      </Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: wide ? 24 : 20, lineHeight: wide ? 32 : 28, color: palette.wine }}>
        Context creates clarity.{"\n"}Clarity creates confidence.
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 18, lineHeight: 28, color: palette.muted, maxWidth: 460 }}>
        We are building a new way to buy. Start with one product.
      </Text>
      <View style={{ gap: 8, maxWidth: 320, paddingTop: 6 }}>
        <MovementButton label="Get Started" onPress={started} />
        <TextLink label="Already an Unmasker? Sign in" color={palette.wine} onPress={() => go("/(auth)/sign-in")} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.page }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 72 }}>
        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: palette.wine, letterSpacing: -0.4 }}>Unmask</Text>
          <TextLink label="Sign in" color={palette.ink} onPress={() => go("/(auth)/sign-in")} />
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingTop: 18, paddingBottom: 36, gap: wide ? 28 : 36, flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch" }}>
          {hero}
          <View style={{ flex: 1, minWidth: wide ? 340 : undefined }}>
            <OrientationFilm />
          </View>
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingBottom: 28 }}>
          <CommunityWithUs />
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, gap: 18 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.6, color: palette.gold }}>COUNTDOWN WITH US</Text>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: wide ? 40 : 32, lineHeight: wide ? 48 : 40, letterSpacing: -0.6, color: palette.ink, maxWidth: 720 }}>
            We are building Unmask in public.
          </Text>
          <First90 />
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingTop: 64, gap: 28 }}>
          <View style={{ gap: 12, maxWidth: 640 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.6, color: palette.gold }}>THE HABIT</Text>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.displayBold, fontSize: wide ? 40 : 32, lineHeight: wide ? 48 : 40, letterSpacing: -0.6, color: palette.ink }}>
              Start with one product.
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: palette.muted }}>
              One product. One timeline. Don’t wait for a perfect record. Begin where you are.
            </Text>
          </View>
          <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 28 : 22, alignItems: "stretch" }}>
            <Image
              source={require("../../assets/unmask-reference/scan-product.png")}
              accessibilityLabel="A product bottle. An illustration, not a reviewed product."
              style={{ width: wide ? 380 : "100%", height: wide ? 460 : 320, borderRadius: 28, backgroundColor: palette.quiet }}
              resizeMode="cover"
            />
            <View style={{ flex: 1, gap: 18, justifyContent: "center" }}>
              {HABIT.map((step) => (
                <View key={step.n} style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.gold, width: 36 }}>{step.n}</Text>
                  <View style={{ flex: 1, gap: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.line }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: palette.ink }}>{step.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: palette.muted }}>{step.line}</Text>
                  </View>
                </View>
              ))}
              <MovementButton label="Start with one product" onPress={oneProduct} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingTop: 64, gap: 22 }}>
          <View style={{ gap: 10, maxWidth: 640 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.6, color: palette.gold }}>OPEN TODAY</Text>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.displayBold, fontSize: wide ? 36 : 28, lineHeight: wide ? 44 : 36, letterSpacing: -0.4, color: palette.ink }}>
              What you can do now.
            </Text>
          </View>
          <View style={{ backgroundColor: palette.card, borderRadius: 28, borderWidth: 1, borderColor: palette.line, padding: 18, gap: 14 }}>
            <SearchField value={query} onChange={setQuery} onSubmit={search} placeholder="Search a product" />
            {query.trim().length > 1 ? <MovementButton label="Search products" onPress={search} /> : null}
          </View>
          <View style={{ gap: 12 }}>
            {OPEN.map((item, index) => (
              <Pressable
                key={item.title}
                accessibilityRole="link"
                accessibilityLabel={`${item.title}. ${item.line}`}
                onPress={() => {
                  hapticSelect();
                  go(item.href);
                }}
                style={({ pressed }) => ({
                  minHeight: 112,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: pressed ? palette.quiet : palette.card,
                  flexDirection: "row",
                  alignItems: "stretch",
                })}
              >
                <Image
                  source={index % 2 === 0 ? require("../../assets/unmask-reference/scan-product.png") : require("../../assets/brand/ultra-veil.jpg")}
                  accessibilityIgnoresInvertColors
                  style={{ width: 112, height: 112 }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 16, gap: 6, justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: palette.ink }}>{item.title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: palette.muted }}>{item.line}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingTop: 72, gap: 18, maxWidth: 760 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.6, color: palette.gold }}>THE UNMASKING WAY</Text>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayBold, fontSize: wide ? 36 : 28, lineHeight: wide ? 44 : 36, letterSpacing: -0.4, color: palette.ink }}>
            The Unmasker Code.
          </Text>
          {CODE.map((line) => (
            <Text key={line} style={{ fontFamily: fonts.semibold, fontSize: wide ? 24 : 20, lineHeight: wide ? 32 : 28, color: palette.ink }}>
              {line}
            </Text>
          ))}
        </View>

        <View style={{ paddingHorizontal: wide ? 56 : 24, paddingTop: 72, gap: 18, maxWidth: 680 }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: wide ? 40 : 32, lineHeight: wide ? 48 : 40, letterSpacing: -0.5, color: palette.ink }}>
            The next layer is coming.
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: palette.muted }}>
            Day 90 is not the beginning. Don’t just watch Unmask. Unmask with us.
          </Text>
          <View style={{ maxWidth: 320, gap: 4 }}>
            <MovementButton label="Get Started" onPress={started} />
            <TextLink label="Already an Unmasker? Sign in" color={palette.wine} onPress={() => go("/(auth)/sign-in")} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
