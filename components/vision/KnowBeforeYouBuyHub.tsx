import { useMemo } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import {
  ArrowLeft,
  Bell,
  Camera,
  CaretRight,
  MagnifyingGlass,
  SealCheck,
  SlidersHorizontal,
  Star,
  Tag,
  UsersThree,
} from "@/components/icons";
import { AppShell, MediaFrame, PersonAvatar, ContentSkeleton, StatusMessage } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import { popularBeautyProducts } from "@/lib/unmask/communitySearch";
import type { Product } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const TOP_TABS = ["All Results", "Products", "Experiences", "Questions", "Brands"] as const;
const CATEGORY_CARDS = [
  ["Cleansers", "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=500&q=80&auto=format&fit=crop"],
  ["Moisturizers", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&q=80&auto=format&fit=crop"],
  ["Serums", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&q=80&auto=format&fit=crop"],
  ["Sunscreens", "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&q=80&auto=format&fit=crop"],
  ["Exfoliators", "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=500&q=80&auto=format&fit=crop"],
  ["Toners", "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=500&q=80&auto=format&fit=crop"],
] as const;

export function KnowBeforeYouBuyHub({
  query,
  draft,
  onDraftChange,
  onSubmit,
  products,
  loading,
  onPick,
}: {
  query: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  products: Product[];
  loading?: boolean;
  onPick: (p: Product) => void;
}) {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const history = useAppStore((s) => s.searchHistory);
  const addSearch = useAppStore((s) => s.addSearch);

  const popular = useQuery({
    queryKey: ["know-before-buy-popular"],
    queryFn: () => popularBeautyProducts(8),
    enabled: !query.trim(),
    staleTime: 300000,
  });

  const hero = products[0];
  const pid = hero?.id;
  const experiences = useQuery({
    queryKey: ["product-experiences-search", pid],
    queryFn: () => clarity.experiences(false, pid),
    enabled: !!pid,
    staleTime: 60000,
  });
  const questions = useQuery({
    queryKey: ["product-questions-search", pid],
    queryFn: () => living.questions(pid),
    enabled: !!pid,
    staleTime: 60000,
  });

  const recent = history.slice(0, 3);
  const discover = useMemo(() => (popular.data ?? []).slice(0, 2), [popular.data]);

  const submitSearch = () => {
    const q = draft.trim();
    if (!q) return;
    addSearch(q);
    onSubmit();
  };

  if (!query.trim()) {
    return (
      <AppShell navigation flush scroll={false} ambient="page" hideHeader>
        <View style={{ flex: 1, backgroundColor: "#FEF4F2" }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
            <View style={{ paddingHorizontal: 32, paddingTop: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 33, color: "#151019", letterSpacing: -1.5 }}>
                  Unmask<Text style={{ color: "#C96B72" }}>*</Text>
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Bell size={28} color="#151019" />
                  <PersonAvatar id={uid || "you"} name="You" size={42} />
                </View>
              </View>
              <View style={{ marginTop: 22, gap: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 2.1, color: "#80636D" }}>PRODUCT DISCOVERY</Text>
                <Text style={{ fontFamily: fonts.serifBold, fontSize: 35, lineHeight: 39, color: "#17101A", letterSpacing: -1.1 }}>
                  Understand products{"\n"}before you buy.
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 16.5, lineHeight: 23, color: "#6A6269" }}>
                  Real experiences. Real routines. Real context.
                </Text>
              </View>

              <View style={{ marginTop: 14, minHeight: 64, borderRadius: 32, borderWidth: 1, borderColor: "#D9CDCF", backgroundColor: "#FFFDFC", flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 10 }}>
                <MagnifyingGlass size={26} color="#28182C" />
                <TextInput
                  value={draft}
                  onChangeText={onDraftChange}
                  onSubmitEditing={submitSearch}
                  returnKeyType="search"
                  placeholder="Search products, brands, or experiences"
                  placeholderTextColor="#766D75"
                  style={{ flex: 1, fontFamily: fonts.regular, fontSize: 17, color: "#241329" }}
                />
                <Pressable onPress={() => hapticSelect()} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "#F6E0D5", alignItems: "center", justifyContent: "center" }}>
                  <Camera size={23} color="#4A2930" />
                </Pressable>
              </View>

              <View style={{ marginTop: 13, gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: "#17101A" }}>Recent searches</Text>
                  {recent.length ? <Pressable onPress={() => useAppStore.setState({ searchHistory: [] })}><Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: "#B46A4D" }}>Clear all</Text></Pressable> : null}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
                  {recent.map((r) => (
                    <Pressable key={r.id} onPress={() => { onDraftChange(r.query); addSearch(r.query); onSubmit(); }} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#F6ECE7" }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: "#332833" }}>◷  {r.query}</Text>
                    </Pressable>
                  ))}
                  {!recent.length ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "#81757B" }}>Your recent searches will appear here.</Text> : null}
                </ScrollView>
              </View>

              <View style={{ marginTop: 13, gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: "#17101A" }}>Explore by category</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: "#B46A4D" }}>See all  ›</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORY_CARDS.map(([label, image]) => (
                    <Pressable key={label} onPress={() => { onDraftChange(label); onSubmit(); }} style={{ width: 125, height: 138, borderRadius: 18, overflow: "hidden", backgroundColor: "#F5E7E1" }}>
                      <Image source={{ uri: image }} style={{ width: "100%", height: 92 }} resizeMode="cover" />
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: "#241329" }}>{label}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={{ marginTop: 13, gap: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: "#17101A" }}>Discover products</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {["Trending", "Most Reviewed", "By Skin Type", "🇳🇬 New in Nigeria"].map((label, i) => (
                    <Pressable key={label} onPress={() => i === 0 && onDraftChange("trending")} style={{ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: i === 0 ? "#231F20" : "#D7CDCF", backgroundColor: i === 0 ? "#2B2628" : "#FFFDFC" }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: i === 0 ? "#FFF" : "#3C2E38" }}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {popular.isLoading ? <ContentSkeleton rows={2} /> : null}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {discover.map((p) => (
                    <Pressable key={p.id} onPress={() => onPick(p as unknown as Product)} style={{ flex: 1, borderRadius: 22, overflow: "hidden", backgroundColor: "#F2E7E2", minHeight: 250 }}>
                      <View style={{ height: 170 }}>
                        <MediaFrame uri={p.heroImageUrl} label={p.name} ratio={1} corners={false} />
                        <View style={{ position: "absolute", left: 10, top: 10, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F8D5C9" }}>
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: "#6C2D31" }}>{i18nTag(i)}</Text>
                        </View>
                      </View>
                      <View style={{ padding: 11, gap: 3 }}>
                        <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 15, color: "#241329" }}>{p.name}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: "#6F6269" }}>{p.brand}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </AppShell>
    );
  }

  const expCount = experiences.data?.length ?? 0;
  const qCount = questions.data?.length ?? 0;
  const resultTabs = [
    ["All Results", products.length + expCount + qCount],
    ["Products", products.length],
    ["Experiences", expCount],
    ["Questions", qCount],
    ["Brands", hero?.brand ? 1 : 0],
  ] as const;

  return (
    <AppShell navigation flush scroll={false} ambient="page" hideHeader>
      <View style={{ flex: 1, backgroundColor: "#FEF4F2" }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
          <View style={{ paddingHorizontal: 34, paddingTop: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F5E6E5", alignItems: "center", justifyContent: "center" }}>
                <ArrowLeft size={23} color="#241329" />
              </Pressable>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: "#151019", letterSpacing: -1.2 }}>Unmask<Text style={{ color: "#C96B72" }}>*</Text></Text>
              <Bell size={26} color="#151019" />
            </View>

            <View style={{ minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: "#D8CCCF", backgroundColor: "#FFFDFC", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}>
              <MagnifyingGlass size={24} color="#241329" />
              <TextInput value={draft} onChangeText={onDraftChange} onSubmitEditing={submitSearch} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: "#241329" }} />
              <Pressable onPress={() => router.replace("/results" as Href)}><Text style={{ fontSize: 24, color: "#8B8588" }}>×</Text></Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TOP_TABS.map((tab) => {
                const active = tab === "All Results";
                return (
                  <View key={tab} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, backgroundColor: active ? "#5B7420" : "#F7EDE8" }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: active ? "#FFF" : "#241329" }}>{tab}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: "#17101A" }}>Results for “{query}”</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "#6F656B" }}>{products.length + expCount + qCount} results · Products, experiences, questions & brand info</Text>
              </View>
              <Pressable style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, backgroundColor: "#F8E9E5", flexDirection: "row", alignItems: "center", gap: 5 }}>
                <SlidersHorizontal size={17} color="#332433" />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: "#332433" }}>Filters</Text>
              </Pressable>
            </View>

            {loading ? <ContentSkeleton rows={2} /> : null}
            {hero ? (
              <Pressable onPress={() => onPick(hero)} style={{ borderRadius: 24, backgroundColor: "#FFFDFC", borderWidth: 1, borderColor: "#E6DAD7", padding: 10, flexDirection: "row", gap: 14 }}>
                <View style={{ width: 225, height: 300, borderRadius: 20, overflow: "hidden" }}>
                  <MediaFrame uri={hero.heroImageUrl} label={hero.name} ratio={0.75} corners={false} />
                </View>
                <View style={{ flex: 1, paddingTop: 8, gap: 8 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#6A5862" }}>{hero.brand} <SealCheck size={14} color="#687C43" weight="fill" /></Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 25, lineHeight: 27, color: "#17101A" }}>{hero.name}</Text>
                  <Text numberOfLines={3} style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: "#625A61" }}>{hero.description || "Product details, real experiences and community context."}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#EAF0D7" }}><Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: "#475426" }}>{hero.category || "Beauty"}</Text></View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F7D9CB" }}><Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: "#704132" }}>Barrier-friendly</Text></View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#EAF0D7" }}><Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: "#475426" }}>Non-comedogenic</Text></View>
                  </View>
                  <View style={{ marginTop: 2, padding: 12, borderRadius: 17, backgroundColor: "#EFF2DC", flexDirection: "row", gap: 10 }}>
                    <UsersThree size={20} color="#4B5D28" />
                    <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: "#46512E" }}>Most shared by</Text><Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: "#26331A" }}>Unmask community</Text></View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
                    <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#241329" }}>{hero.rating != null ? hero.rating.toFixed(1) : "—"}/5</Text><Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: "#6B6268" }}>{hero.ratingCount ? `${hero.ratingCount.toLocaleString()} ratings` : "ratings unavailable"}</Text></View>
                    <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#241329" }}>{expCount.toLocaleString()}</Text><Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: "#6B6268" }}>Experiences</Text></View>
                    <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#241329" }}>{qCount.toLocaleString()}</Text><Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: "#6B6268" }}>Questions</Text></View>
                  </View>
                </View>
              </Pressable>
            ) : null}

            <View style={{ gap: 8, marginTop: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: "#17101A" }}>Explore more</Text>
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#D9CDCF" }}>
                {["Experiences", "Questions", "Brands"].map((t, i) => (
                  <View key={t} style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: i === 0 ? 3 : 0, borderColor: "#607A2D" }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#241329" }}>{t} ({i === 0 ? expCount.toLocaleString() : i === 1 ? qCount.toLocaleString() : hero?.brand ? 1 : 0})</Text>
                  </View>
                ))}
              </View>
            </View>

            {products.slice(1, 4).map((p) => (
              <Pressable key={p.id} onPress={() => onPick(p)} style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: 20, backgroundColor: "#FFF9F7", borderWidth: 1, borderColor: "#E7DAD7" }}>
                <View style={{ width: 88, height: 88, borderRadius: 15, overflow: "hidden" }}><MediaFrame uri={p.heroImageUrl} label={p.name} ratio={1} corners={false} /></View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#241329" }}>{p.name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "#6F656B" }}>{p.brand} · {p.category}</Text>
                </View>
                <CaretRight size={20} color="#241329" />
              </Pressable>
            ))}

            {!hero && !loading ? <StatusMessage title="No product match yet." detail="Try the exact product or brand name on the label." /> : null}
          </View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

function i18nTag(i: number) {
  return i === 0 ? "Most Shared" : "Highly Reviewed";
}
