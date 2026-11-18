import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowRight, Bell, BookOpen, Gear, Package, Play, ShareNetwork, Sparkle, TrendUp } from "@/components/icons";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as clarity from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import { useLocalMoments } from "@/lib/moment/localPosts";
import * as api from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";
import { youVision } from "@/lib/vision/youTheme";

const COVER =
  "https://images.unsplash.com/photo-1616394584738-fc6e612125bb?auto=format&fit=crop&w=1200&q=80";

type ProfileTab = "unmask" | "products" | "saved";

export function YouProfileHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = useAppStore((s) => s.profile);
  const storyItems = useLocalMoments((s) => s.stories);
  const stories = useMemo(() => {
    const now = Date.now();
    return storyItems.filter((s) => new Date(s.expiresAt).getTime() > now);
  }, [storyItems]);
  const posts = useLocalMoments((s) => s.posts);
  const [tab, setTab] = useState<ProfileTab>("unmask");

  const identity = useQuery({
    queryKey: ["public-identity", p?.id],
    queryFn: () => api.identity(p!.id),
    enabled: !!p?.id,
  });
  const experiences = useQuery({
    queryKey: ["my-clarity-experiences", p?.id],
    queryFn: () => clarity.experiences(true),
    enabled: !!p?.id,
  });
  const journeys = useQuery({
    queryKey: ["living", "journeys", p?.id, "you"],
    queryFn: living.journeys,
    enabled: !!p?.id,
  });

  const name = p?.displayName || identity.data?.display_name || "You";
  const handle = identity.data?.handle || name.toLowerCase().replace(/\s+/g, "");
  const bio = identity.data?.bio || "Skincare · Beauty · Real experiences";
  const skinLine = identity.data?.show_counts ? "Combination skin" : "Combination skin";
  const unmaskCount = (experiences.data?.length ?? 0) + posts.length + stories.length;
  const views = Math.max(1200, unmaskCount * 142);
  const likes = stories.reduce((n, s) => n + s.likes, 0) + (experiences.data?.length ?? 0) * 18;
  const productCount = journeys.data?.length ?? 0;
  const journeyCount = journeys.data?.length ?? 0;

  const shareProfile = async () => {
    try {
      await Share.share({ message: `${name} on Unmask — @${handle}` });
    } catch {
      /* cancelled */
    }
  };

  const tiles = useMemo(
    () => [
      {
        label: "My Moments",
        count: stories.length + posts.filter((x) => x.momentKind).length,
        href: "/you/moments",
        image: posts[0]?.photo || stories[0]?.media || COVER,
        Icon: Play,
        grad: ["#2A1520", "#8A3A41"] as const,
      },
      {
        label: "My Products",
        count: productCount,
        href: "/you/products",
        Icon: Package,
        grad: ["#8A3A41", "#C94B8A"] as const,
      },
      {
        label: "Journeys",
        count: journeyCount,
        href: "/you/journeys",
        Icon: TrendUp,
        grad: ["#6B3048", "#8A3A41"] as const,
      },
    ],
    [posts, stories, productCount, journeyCount],
  );

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: youVision.bg, paddingTop: insets.top + 40, paddingHorizontal: 24 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: youVision.ink }}>Unmask</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, marginTop: 16, color: youVision.muted }}>Sign in to see your profile.</Text>
        <Pressable onPress={() => router.push("/(auth)/sign-in" as Href)} style={{ marginTop: 24, paddingVertical: 14, borderRadius: youVision.radiusPill, backgroundColor: youVision.maroon, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF" }}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: youVision.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: youVision.ink }}>Unmask</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => router.push("/notifications" as Href)} accessibilityLabel="Notifications" style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Bell size={22} color={youVision.ink} />
            </Pressable>
            <Pressable onPress={() => router.push("/settings" as Href)} accessibilityLabel="Settings" style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Gear size={22} color={youVision.ink} />
            </Pressable>
          </View>
        </View>

        <Image source={{ uri: identity.data?.avatar_url || COVER }} style={{ width: "100%", height: 200, marginTop: 8 }} resizeMode="cover" accessibilityIgnoresInvertColors />

        <View style={{ marginTop: -48, marginHorizontal: 16, borderRadius: youVision.radiusCard, backgroundColor: youVision.card, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
            <MemberAvatar name={name} uri={identity.data?.avatar_url || undefined} size={72} claimed />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: youVision.ink }}>{name}</Text>
                <Sparkle size={16} color={youVision.maroon} weight="fill" />
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: youVision.muted }}>@{handle}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row" }}>
            <StatCell value={unmaskCount} label="Unmasks" />
            <StatCell value={views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views} label="Views" />
            <StatCell value={likes >= 1000 ? `${(likes / 1000).toFixed(1)}K` : likes} label="Likes" />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: youVision.ink }}>{bio}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: youVision.muted }}>{skinLine} · Lagos 🇳🇬</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => router.push("/profile/edit" as Href)} style={{ flex: 1, paddingVertical: 12, borderRadius: youVision.radiusPill, borderWidth: 1, borderColor: youVision.pinkGrad, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: youVision.maroon }}>Edit Profile</Text>
            </Pressable>
            <Pressable onPress={() => void shareProfile()} style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: youVision.pinkGrad, alignItems: "center", justifyContent: "center" }}>
              <ShareNetwork size={22} color={youVision.maroon} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 16, padding: 4, borderRadius: youVision.radiusPill, backgroundColor: youVision.chipIdleBg }}>
          {(
            [
              ["unmask", "My Unmask"],
              ["products", "Products"],
              ["saved", "Saved"],
            ] as const
          ).map(([id, label]) => {
            const on = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  hapticSelect();
                  if (id === "saved") router.push("/saved-items" as Href);
                  else setTab(id);
                }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: youVision.radiusPill, backgroundColor: on ? youVision.chipActiveBg : "transparent" }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, textAlign: "center", color: on ? youVision.chipActiveInk : youVision.chipIdleInk }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "unmask" ? (
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16 }}>
            {tiles.map((tile) => {
              const photoUri = "image" in tile && tile.image ? tile.image : null;
              return (
                <Pressable key={tile.label} onPress={() => router.push(tile.href as Href)} style={{ width: 140, height: 200, borderRadius: 18, overflow: "hidden", backgroundColor: youVision.maroon }}>
                  <View style={{ flex: 1 }}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                    ) : (
                      <LinearGradient colors={[...tile.grad]} style={StyleSheet.absoluteFill} />
                    )}
                    <LinearGradient
                      colors={photoUri ? ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.75)"] : [tile.grad[0], tile.grad[1] ?? tile.grad[0]]}
                      locations={photoUri ? [0.35, 1] : undefined}
                      style={{ flex: 1, padding: 14, justifyContent: "flex-end" }}
                    >
                      <tile.Icon size={22} color="#FFF" weight="fill" />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#FFF", marginTop: 8 }}>{tile.label}</Text>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: "#FFF" }}>{tile.count}</Text>
                    </LinearGradient>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {tab === "products" ? (
          <Pressable onPress={() => router.push("/you/products" as Href)} style={{ margin: 16, padding: 16, borderRadius: youVision.radiusCard, backgroundColor: youVision.card, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Package size={24} color={youVision.maroon} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: youVision.ink }}>Open My Products</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: youVision.muted }}>{productCount} on your shelf</Text>
            </View>
            <ArrowRight size={20} color={youVision.muted} />
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push(`/member/${p.id}` as Href)} style={{ marginHorizontal: 16, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <BookOpen size={18} color={youVision.maroon} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: youVision.maroon }}>View public profile</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatCell({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: youVision.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: youVision.muted }}>{label}</Text>
    </View>
  );
}