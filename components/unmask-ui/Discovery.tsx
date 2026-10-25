import { Image, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  ChatCircle,
  Clock,
  PencilSimple,
  Sparkle,
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
        minHeight: 230,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            flex: 1.3,
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
              fontSize: 35,
              lineHeight: 37,
              color: colors.brandDeep,
              letterSpacing: -0.7,
            }}
          >
            Less guesswork.{"\n"}More clarity.
          </Text>
          <Text style={body}>
            Real experiences. Better questions. A closer look at what matters to
            you.
          </Text>
        </View>
        <Image
          source={require("../../assets/unmask-reference/scan-product.png")}
          accessibilityLabel="Illustration of a skincare bottle, not a reviewed product"
          style={{ flex: 1, minHeight: 250 }}
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
        r.push("/unmask");
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
            <Sparkle size={18} color="#E9CD83" weight="fill" />
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
          Your story deserves{"\n"}a closer look.
        </Text>
        <Text style={{ ...body, color: "#EBDADF" }}>
          Loved it? Let down? Help a creator explore why — with community
          support, company questions and expert context.
        </Text>
        <Text
          style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#fff" }}
        >
          See what we’re taking further
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
