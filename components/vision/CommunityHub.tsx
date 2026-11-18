import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookmarkSimple, DotsThree, MagnifyingGlass, PencilSimple } from "@/components/icons";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { timeAgo } from "@/lib/community";
import { SAMPLE_FEED } from "@/lib/unmask/samples";
import { searchVision } from "@/lib/vision/searchTheme";
import { useAppStore } from "@/lib/store";

const FILTERS = ["All", "Questions", "Experiences", "Tips"] as const;

type Row = {
  id: string;
  author: string;
  authorId?: string;
  skin?: string;
  hoursAgo: string;
  title: string;
  productName?: string;
  productImage?: string | null;
  answers: number;
  views: number;
  href: string;
};

export function CommunityHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const demo = useAppStore((s) => s.demoCommunity);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Questions");
  const [search, setSearch] = useState("");

  const live = useQuery({
    queryKey: ["community-hub-questions"],
    queryFn: () => living.questions(),
  });

  const rows = useMemo(() => {
    const sampleQs: Row[] = demo
      ? SAMPLE_FEED.filter((f) => f.kind === "question").map((f) => ({
          id: f.id,
          author: f.author,
          hoursAgo: timeAgo(f.createdAt),
          title: f.title,
          productName: f.productName ?? undefined,
          productImage: f.productImage,
          answers: f.replies ?? 72,
          views: 1900,
          href: f.href,
        }))
      : [];
    const fromDb: Row[] = (live.data ?? []).map((q) => ({
      id: q.id,
      author: q.author_name || "Unmasker",
      authorId: q.user_id,
      skin: q.skin_type || undefined,
      hoursAgo: timeAgo(q.created_at),
      title: q.body.length > 120 ? `${q.body.slice(0, 120)}…` : q.body,
      productName: undefined,
      productImage: null,
      answers: 0,
      views: 0,
      href: `/question/${q.id}`,
    }));
    let list = [...sampleQs, ...fromDb];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => `${r.title} ${r.productName}`.toLowerCase().includes(q));
    if (filter === "Experiences") list = [];
  if (filter === "Tips") list = list.slice(0, 0);
    return list;
  }, [demo, live.data, search, filter]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[searchVision.burgundy, searchVision.burgundyDeep, "#FCE4EC"]} locations={[0, 0.35, 1]} style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 32, color: "#FFF8F4", letterSpacing: -0.5 }}>Community</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: "rgba(255,248,244,0.88)", marginTop: 6, marginBottom: 16 }}>
          Ask, learn and share with Unmaskers like you.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 8 }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => {
                  hapticSelect();
                  setFilter(f);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: searchVision.radiusPill,
                  backgroundColor: on ? searchVision.chipActiveBg : searchVision.chipIdleBg,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? searchVision.chipActiveInk : searchVision.chipIdleInk }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 10, marginBottom: 4 }}>
          <TextInputRow search={search} onChange={setSearch} />
        </View>
        {rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(row.href as Href)}
            style={{
              borderRadius: searchVision.radiusCard,
              backgroundColor: searchVision.card,
              padding: 16,
              gap: 12,
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PersonAvatar id={row.authorId || row.author} name={row.author} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: searchVision.ink }}>{row.author}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: searchVision.muted }}>
                  {row.hoursAgo}
                  {row.skin ? ` · ${row.skin} skin` : ""}
                </Text>
              </View>
              <DotsThree size={22} color={searchVision.muted} weight="bold" />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: searchVision.ink }}>{row.title}</Text>
            {row.productName ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, backgroundColor: "#F5F0F2" }}>
                {row.productImage ? (
                  <Image source={{ uri: row.productImage }} style={{ width: 40, height: 40, borderRadius: 10 }} accessibilityIgnoresInvertColors />
                ) : null}
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: searchVision.ink, flex: 1 }}>{row.productName}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: searchVision.muted }}>
                {row.answers || 12} answers • {(row.views || 1200).toLocaleString()} views
              </Text>
              <BookmarkSimple size={20} color={searchVision.muted} />
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/community-ask" as Href)}
        style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 88 }}
      >
        <LinearGradient colors={[searchVision.accent, searchVision.accentDeep]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: searchVision.radiusPill }}>
          <PencilSimple size={20} color="#FFF" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF" }}>Ask a Question</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function TextInputRow({ search, onChange }: { search: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 48, borderRadius: searchVision.radiusPill, backgroundColor: "#FFF" }}>
      <MagnifyingGlass size={18} color={searchVision.muted} />
      <TextInput
        value={search}
        onChangeText={onChange}
        placeholder="Search questions, products…"
        placeholderTextColor={searchVision.muted}
        style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: searchVision.ink, paddingVertical: 8 }}
      />
    </View>
  );
}