import { Image, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  ChatCircle,
  Clock,
  PencilSimple,
  Lightning,
  ShieldCheck,
  MagnifyingGlass,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
const body = {
  fontFamily: fonts.regular,
  fontSize: 15,
  lineHeight: 22,
  color: colors.inkSoft,
};
export function DiscoveryHero() {
  return (
    <View
      style={{
        marginHorizontal: 20,
        borderRadius: 26,
        overflow: "hidden",
        backgroundColor: "#F4EEE9",
        minHeight: 220,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            width: "61%",
            minHeight: 220,
            padding: 22,
            gap: 12,
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={16} color={colors.brand} />
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 12,
                color: colors.brand,
              }}
            >
              Before you buy. After you try.
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.serifBold,
              fontSize: 32,
              lineHeight: 35,
              color: colors.brandDeep,
              letterSpacing: -0.7,
            }}
          >
            Buy with{"\n"}clarity.
          </Text>
          <Text style={body}>
            See real experiences. Ask people who’ve tried it.
          </Text>
        </View>
        <Image
          source={require("../../assets/unmask-reference/scan-product.png")}
          accessibilityLabel="Illustration of a skincare bottle, not a reviewed product"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "39%",
            height: "100%",
          }}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}
export function QuickActions() {
  const r = useRouter();
  return (
    <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 20 }}>
      {[
        {
          title: "Share",
          sub: "Your experience",
          href: "/contribute",
          Icon: PencilSimple,
          bg: "#F6ECEF",
          fg: colors.brand,
        },
        {
          title: "Ask",
          sub: "The community",
          href: "/ask-community",
          Icon: ChatCircle,
          bg: "#EDF2EC",
          fg: "#365D41",
        },
        {
          title: "Track",
          sub: "What changes",
          href: "/products/add",
          Icon: Clock,
          bg: "#FBF1DD",
          fg: "#80590C",
        },
      ].map(({ title, sub, href, Icon, bg, fg }) => (
        <Pressable
          key={title}
          accessibilityRole="button"
          accessibilityLabel={`${title}: ${sub}`}
          onPress={() => {
            hapticSelect();
            r.push(href as Href);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 112,
            padding: 14,
            borderRadius: 19,
            backgroundColor: pressed ? "#EBE4DF" : bg,
            gap: 6,
          })}
        >
          <Icon size={24} color={fg} />
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 16,
              color: colors.ink,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              color: colors.inkSoft,
            }}
          >
            {sub}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function UltraInvitation() {
  const r = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Explore Ultra Unmasks: take a product question further"
      onPress={() => {
        hapticSelect();
        r.push("/ultra-unmask" as Href);
      }}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        borderRadius: 24,
        overflow: "hidden",
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <LinearGradient
        colors={["#58202D", "#321019"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 22, gap: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Lightning size={18} color="#E9CD83" weight="fill" />
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 12,
                color: "#E9CD83",
                letterSpacing: 1,
              }}
            >
              ULTRA UNMASK
            </Text>
          </View>
          <ArrowRight size={20} color="#fff" />
        </View>
        <Text
          style={{
            fontFamily: fonts.serifBold,
            fontSize: 28,
            lineHeight: 31,
            color: "#fff",
          }}
        >
          A creator takes your product question further.
        </Text>
        <Text style={{ ...body, color: "#EBDADF" }}>
          Ultra Unmask is a creator-led deep dive. Share what happened, add
          Sparks, and help a creator ask the company or an expert why. Good
          experiences belong here too.
        </Text>
        <Text
          style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#fff" }}
        >
          Explore Ultra Unmask
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
