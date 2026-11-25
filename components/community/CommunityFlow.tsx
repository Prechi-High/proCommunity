import { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  ActionButton,
  AppShell,
  ContentSkeleton,
  FilterChips,
  MediaFrame,
  StatusMessage,
} from "@/components/unmask-ui";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import {
  BookmarkSimple,
  Camera,
  ChatCircle,
  Check,
  DotsThree,
  Heart,
  MagnifyingGlass,
  Plus,
  ShareNetwork,
  SlidersHorizontal,
  UsersThree,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import * as community from "@/lib/community-v2/api";
import { SAMPLE_FEED } from "@/lib/unmask/samples";
import { timeAgo } from "@/lib/community";
import { useAppStore } from "@/lib/store";
import { hapticSaved, hapticSelect, hapticTap } from "@/lib/haptics";

const FILTERS = ["All", "Skincare", "Makeup", "Hair", "Body"] as const;
type Filter = (typeof FILTERS)[number];

type FeedRow = {
  id: string;
  kind: "question" | "experience";
  author: string;
  authorId?: string;
  title: string;
  body?: string;
  productId?: string | null;
  productName?: string;
  productBrand?: string;
  productImage?: string | null;
  skin?: string | null;
  duration?: string | null;
  frequency?: string | null;
  answers?: number;
  helpful?: number;
  views?: number;
  createdAt: string;
  href: string;
};

function productMatches(row: FeedRow, filter: Filter) {
  if (filter === "All") return true;
  const text = `${row.productName || ""} ${row.productBrand || ""}`.toLowerCase();
  return filter === "Skincare"
    ? /skin|cleanser|serum|cream|moistur|spf|lotion|face/.test(text)
    : filter === "Makeup"
      ? /makeup|foundation|concealer|lip|mascara|blush/.test(text)
      : filter === "Hair"
        ? /hair|shampoo|conditioner|scalp/.test(text)
        : /body|deodor|wash|lotion/.test(text);
}

function ProductCard({ row, compact = false }: { row: FeedRow; compact?: boolean }) {
  return (
    <View style={{
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      padding: 12,
      borderRadius: 18,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.line,
    }}>
      <View style={{ width: compact ? 62 : 82, height: compact ? 62 : 82 }}>
        <MediaFrame uri={row.productImage} label={row.productName || "Product"} ratio={1} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: compact ? 15 : 17, color: colors.ink }}>
          {row.productName || "Product"}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
          {row.productBrand || "Beauty"}
        </Text>
      </View>
    </View>
  );
}

export function CommunityHub() {
  const router = useRouter();
  const demo = useAppStore((s) => s.demoCommunity);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const catalog = useQuery({ queryKey: ["community-catalog"], queryFn: () => living.catalog() });
  const questions = useQuery({ queryKey: ["community-questions"], queryFn: () => living.questions() });
  const experiences = useQuery({ queryKey: ["community-experiences"], queryFn: () => clarity.experiences(false) });

  const rows = useMemo<FeedRow[]>(() => {
    const products = new Map((catalog.data || []).map((p) => [p.id, p]));
    const liveQuestions = (questions.data || []).map((q) => {
      const p = q.product_id ? products.get(q.product_id) : undefined;
      return {
        id: q.id,
        kind: "question" as const,
        author: q.author_name || "Unmasker",
        authorId: q.user_id,
        title: q.body,
        body: q.context || undefined,
        productId: q.product_id,
        productName: p?.name,
        productBrand: p?.brand || undefined,
        productImage: p?.image_url,
        skin: q.skin_type,
        answers: 0,
        views: 0,
        createdAt: q.created_at,
        href: `/question/${q.id}`,
      };
    });
    const liveExperiences = (experiences.data || []).map((e) => ({
      id: e.id,
      kind: "experience" as const,
      author: e.author_name || "Unmasker",
      authorId: e.user_id,
      title: e.body,
      body: e.body,
      productId: e.product_id,
      productName: e.unmask_catalog?.name,
      productBrand: e.unmask_catalog?.brand,
      productImage: e.unmask_catalog?.image_url,
      skin: e.skin_type,
      duration: e.duration,
      frequency: e.frequency,
      helpful: 0,
      createdAt: e.created_at,
      href: `/story/${e.id}`,
    }));
    const sample = demo ? SAMPLE_FEED.map((f) => ({
      id: f.id,
      kind: (f.kind === "question" ? "question" : "experience") as "question" | "experience",
      author: f.author,
      authorId: undefined,
      title: f.title,
      body: f.body,
      productId: f.productId,
      productName: f.productName,
      productImage: f.productImage,
      skin: f.skinType,
      duration: f.usageDuration,
      frequency: f.usageFrequency,
      answers: f.replies,
      views: 1200,
      helpful: f.likes,
      createdAt: f.createdAt,
      href: f.href,
    })) : [];
    const merged = [...liveQuestions, ...liveExperiences, ...sample]
      .filter((r) => productMatches(r, filter))
      .filter((r) => {
        const q = search.trim().toLowerCase();
        return !q || `${r.title} ${r.productName || ""} ${r.author}`.toLowerCase().includes(q);
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return merged;
  }, [catalog.data, questions.data, experiences.data, demo, filter, search]);

  return (
    <AppShell navigation notify flush scroll={false} ambient="socialNight">
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 36, lineHeight: 42, color: colors.brandDeep }}>
            The Community
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.inkSoft }}>
            Ask, share and get real answers from Unmaskers who actually use the products.
          </Text>
        </View>

        <View style={{
          minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: colors.line,
          backgroundColor: colors.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10,
        }}>
          <MagnifyingGlass size={21} color={colors.inkSoft} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search questions, products or topics"
            placeholderTextColor={colors.inkSoft}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}
          />
          <SlidersHorizontal size={21} color={colors.brandDeep} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable key={f} onPress={() => { hapticSelect(); setFilter(f); }} style={{
                paddingHorizontal: 17, paddingVertical: 10, borderRadius: 999,
                backgroundColor: active ? colors.brandDeep : colors.white,
                borderWidth: active ? 0 : 1, borderColor: colors.line,
              }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: active ? "#FFF" : colors.ink }}>
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => { hapticTap(); router.push("/community-ask" as Href); }}
          style={({ pressed }) => ({
            borderRadius: 24, padding: 18, backgroundColor: colors.brandDeep,
            opacity: pressed ? 0.9 : 1, flexDirection: "row", alignItems: "center", gap: 14,
          })}
        >
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#F7B8D0", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 27, color: colors.brandDeep }}>?</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: "#FFF" }}>Ask the community</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.86)" }}>
              Have a product question, concern or experience to share?
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 25, color: "#FFF" }}>→</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 130, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {questions.isLoading || experiences.isLoading ? <ContentSkeleton rows={3} /> : null}
        {rows.map((row) => (
          <Pressable
            key={`${row.kind}-${row.id}`}
            onPress={() => router.push(row.href as Href)}
            style={({ pressed }) => ({
              borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
              padding: 14, gap: 12, opacity: pressed ? 0.94 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PersonAvatar id={row.authorId || row.author} name={row.author} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{row.author}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>
                  {timeAgo(row.createdAt)}{row.skin ? ` · ${row.skin} skin` : ""}
                </Text>
              </View>
              <DotsThree size={22} color={colors.inkSoft} weight="bold" />
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.ink }}>
              {row.kind === "question" ? row.title : row.title.length > 115 ? `${row.title.slice(0, 115)}…` : row.title}
            </Text>

            {row.productName ? <ProductCard row={row} compact /> : null}

            {row.kind === "experience" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[row.skin, row.duration, row.frequency].filter(Boolean).map((x) => (
                  <View key={x} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F4E7F1" }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.brandDeep }}>{x}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>
                {row.kind === "question" ? `${row.answers || 0} answers` : `${row.helpful || 0} helpful`}
                {row.views ? ` · ${row.views.toLocaleString()} views` : ""}
              </Text>
              <View style={{ flex: 1 }} />
              {row.kind === "question" ? <ChatCircle size={19} color={colors.inkSoft} /> : <Heart size={19} color={colors.coral} />}
              <BookmarkSimple size={19} color={colors.inkSoft} />
            </View>

            {row.kind === "question" ? (
              <Pressable
                onPress={(e) => { e.stopPropagation(); router.push(`/question/${row.id}` as Href); }}
                style={{ alignSelf: "flex-start", paddingHorizontal: 17, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.brandDeep }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF" }}>Answer</Text>
              </Pressable>
            ) : null}
          </Pressable>
        ))}
        {!rows.length && !questions.isLoading && !experiences.isLoading ? (
          <StatusMessage title="Nothing here yet." detail="Try another topic or ask the community a question." />
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

export function CommunityQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const uid = profile?.id;
  const q = useQuery({ queryKey: ["community-question", id], queryFn: () => living.question(id!), enabled: !!id });
  const product = useQuery({ queryKey: ["community-question-product", q.data?.product_id], queryFn: () => living.catalog(q.data!.product_id!), enabled: !!q.data?.product_id });
  const answers = useQuery({ queryKey: ["community-question-answers", id], queryFn: () => living.answers(id!), enabled: !!id });
  const following = useQuery({ queryKey: ["subscriptions", uid], queryFn: living.subscriptions, enabled: !!uid });
  const isFollowing = !!following.data?.some((s) => s.target_type === "product" && s.target_id === q.data?.product_id);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: `/question/${id}` } } as Href);
      return;
    }
    if (!body.trim() || busy || !id) return;
    setBusy(true); setError("");
    try {
      await living.addAnswer({
        question_id: id,
        body: body.trim(),
        duration: "",
        context: q.data?.context || "",
        acquisition: "not_stated",
        uncertainty: "",
      });
      setBody("");
      await qc.invalidateQueries({ queryKey: ["community-question-answers", id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your answer could not be posted.");
    } finally { setBusy(false); }
  };

  return (
    <AppShell back navigation notify title="Community question" ambient="socialNight">
      <View style={{ gap: 18 }}>
        {q.isLoading ? <ContentSkeleton rows={4} /> : null}
        {q.data ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PersonAvatar id={q.data.user_id} name={q.data.author_name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{q.data.author_name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{timeAgo(q.data.created_at)} · Community question</Text>
              </View>
              <Pressable onPress={() => {}}><DotsThree size={22} color={colors.inkSoft} weight="bold" /></Pressable>
            </View>

            <Text style={{ fontFamily: fonts.serifBold, fontSize: 34, lineHeight: 39, color: colors.ink }}>
              {q.data.body}
            </Text>

            {q.data.product_id ? (
              <Pressable onPress={() => router.push(`/product/${q.data!.product_id}` as Href)}>
                <ProductCard row={{
                  id: "product", kind: "question", author: "", title: "", productId: q.data.product_id,
                  productName: product.data?.[0]?.name, productBrand: product.data?.[0]?.brand || undefined,
                  productImage: product.data?.[0]?.image_url, createdAt: "",
                  href: "",
                }} />
              </Pressable>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {[
                q.data.skin_type ? `Skin type · ${q.data.skin_type}` : null,
                q.data.context ? "Context added" : null,
              ].filter(Boolean).map((x) => (
                <View key={x} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4E7F1" }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.brandDeep }}>{x}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{answers.data?.length || 0} Answers</Text>
              <Pressable style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.line }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>Most helpful⌄</Text>
              </Pressable>
            </View>

            {answers.data?.map((a) => {
              const brandAnswer = Boolean((a as any).is_brand || (a as any).author_type === "brand");
              return (
                <View key={a.id} style={{
                  borderRadius: 22, padding: 16, gap: 10,
                  backgroundColor: brandAnswer ? "#F7EAF7" : colors.white,
                  borderWidth: 1, borderColor: colors.line,
                }}>
                  {brandAnswer ? (
                    <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#D8B4E4" }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brandDeep }}>Brand response</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <PersonAvatar id={a.user_id} name={a.author_name} size={42} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{a.author_name}</Text>
                        {brandAnswer ? <Check size={17} color={colors.brandDeep} weight="bold" /> : null}
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{timeAgo(a.created_at)}</Text>
                    </View>
                    <DotsThree size={20} color={colors.inkSoft} weight="bold" />
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{a.body}</Text>
                  <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>♡ {(a as any).helpful_count || 0}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>Helpful</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>Reply</Text>
                  </View>
                </View>
              );
            })}

            <Pressable onPress={() => router.push(`/contribute?product=${q.data?.product_id || ""}&community=1` as Href)} style={{
              borderRadius: 999, paddingVertical: 16, alignItems: "center", backgroundColor: colors.coral,
            }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: "#FFF" }}>Share your experience →</Text>
            </Pressable>

            <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, gap: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Your answer</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Tell them what happened with the product…"
                placeholderTextColor={colors.inkSoft}
                multiline
                style={{ minHeight: 110, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.ink }}
              />
              {error ? <StatusMessage kind="error" title="Answer not posted" detail={error} /> : null}
              <ActionButton label="Post answer" pending={busy} disabled={body.trim().length < 2} onPress={() => void send()} />
            </View>
          </>
        ) : null}
      </View>
    </AppShell>
  );
}

export function CommunityQuestionComposer() {
  const { id, q: initialQuestion } = useLocalSearchParams<{ id: string; q?: string }>();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const product = useQuery({ queryKey: ["community-question-composer-product", id], queryFn: () => living.catalog(id!), enabled: !!id });
  const p = product.data?.[0];
  const [body, setBody] = useState(initialQuestion || "");
  const [skin, setSkin] = useState("Combination");
  const [duration, setDuration] = useState("4 weeks");
  const [routine, setRoutine] = useState("Morning & Evening");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: `/product/${id}/ask-community` } } as Href);
      return;
    }
    if (!id || body.trim().length < 10 || busy) return;
    setBusy(true); setError("");
    try {
      await living.registerProduct({
        id,
        name: p?.name || "Product",
        brand: p?.brand || "",
        category: p?.category || "Beauty",
        heroImageUrl: p?.image_url,
      });
      const out = await living.addQuestion({
        product_id: id,
        body: body.trim(),
        context: `Duration: ${duration}. Routine: ${routine}.`,
        skin_type: skin,
        audience: "same_product",
      });
      hapticSaved(out.id);
      router.replace(`/question/${out.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your question could not be posted.");
    } finally { setBusy(false); }
  };

  return (
    <AppShell back navigation title="Ask about a product" subtitle="Get real answers from Unmaskers who’ve used it in their routines.">
      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <MagnifyingGlass size={22} color={colors.brandDeep} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>Search for a product, brand, or routine</Text>
        </View>
        {p ? <ProductCard row={{ id: "p", kind: "question", author: "", title: "", productId: p.id, productName: p.name, productBrand: p.brand || undefined, productImage: p.image_url, createdAt: "", href: "" }} /> : <ContentSkeleton rows={2} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.ink }}>Your question</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          maxLength={250}
          multiline
          placeholder="Has anyone with combination skin used this for more than 4 weeks? How did it affect your skin?"
          placeholderTextColor={colors.inkSoft}
          style={{ minHeight: 150, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 16, fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: colors.ink, backgroundColor: colors.white }}
        />
        <Text style={{ alignSelf: "flex-end", fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{body.length}/250</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.ink }}>Add your context <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>(optional)</Text></Text>
        <View style={{ gap: 12 }}>
          {[
            ["Skin type", skin, ["Dry","Oily","Combination","Normal","Sensitive"]],
            ["Duration of use", duration, ["1 week","4 weeks","6 weeks","3 months"]],
            ["Your routine", routine, ["Morning","Evening","Morning & Evening","Night only"]],
          ].map(([label, value, options]) => (
            <View key={label as string} style={{ padding: 13, borderRadius: 18, backgroundColor: "#F7EDF4", gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{label as string}</Text>
              <FilterChips
                options={options as string[]}
                value={value as string}
                onChange={label === "Skin type" ? setSkin : label === "Duration of use" ? setDuration : setRoutine}
              />
            </View>
          ))}
        </View>
        {error ? <StatusMessage kind="error" title="Not posted yet" detail={error} /> : null}
        <ActionButton label="Post question →" pending={busy} disabled={body.trim().length < 10} onPress={() => void submit()} />
      </View>
    </AppShell>
  );
}

export function CommunityExperienceComposer() {
  const { product } = useLocalSearchParams<{ product?: string }>();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const catalog = useQuery({ queryKey: ["community-experience-product", product], queryFn: () => living.catalog(product!), enabled: !!product });
  const p = catalog.data?.[0];
  const [skin, setSkin] = useState("Combination");
  const [duration, setDuration] = useState("21 days");
  const [frequency, setFrequency] = useState("Once daily");
  const [routine, setRoutine] = useState("Morning");
  const [body, setBody] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!r.canceled && r.assets[0]?.uri) setPhotoUri(r.assets[0].uri);
  };

  const submit = async () => {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: `/contribute?product=${product}&community=1` } } as Href);
      return;
    }
    if (!product || !body.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const photoPath = photoUri ? await community.uploadPhoto(photoUri) : null;
      const out = await clarity.saveExperience({
        product_id: product,
        body: body.trim(),
        duration,
        frequency,
        usage_status: "Currently using",
        skin_type: skin,
        visibility: "public",
        photo_path: photoPath,
        goal: "",
        outcome: "Not stated",
        uncertainty: "",
        context: routine,
        acquisition: "Prefer not to say",
        would_rebuy: "Not stated",
      });
      hapticSaved(out.id);
      router.replace(`/story/${out.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your experience could not be shared.");
    } finally { setBusy(false); }
  };

  return (
    <AppShell back navigation title="My Product Experience" subtitle="Share what happened with this product in your routine. Keep it real, keep the context.">
      <View style={{ gap: 18 }}>
        {catalog.isLoading ? <ContentSkeleton rows={3} /> : null}
        {p ? <ProductCard row={{
          id: "p", kind: "experience", author: "", title: "", productId: p.id,
          productName: p.name, productBrand: p.brand || undefined, productImage: p.image_url, createdAt: "", href: "",
        }} /> : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            ["Skin type", skin, ["Dry","Oily","Combination","Normal","Sensitive"]],
            ["Duration", duration, ["7 days","21 days","45 days","6 weeks"]],
            ["Frequency", frequency, ["Once daily","2x daily","Every night","Every other day"]],
            ["Routine", routine, ["Morning","Evening","Morning & Evening","Night only"]],
          ].map(([label, value, options]) => (
            <View key={label as string} style={{ width: "48%", gap: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{label as string}</Text>
              <FilterChips
                options={options as string[]}
                value={value as string}
                onChange={label === "Skin type" ? setSkin : label === "Duration" ? setDuration : label === "Frequency" ? setFrequency : setRoutine}
              />
            </View>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.ink }}>What happened?</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Tell the community what changed, what stayed the same, and what surprised you…"
            placeholderTextColor={colors.inkSoft}
            multiline
            maxLength={1000}
            style={{ minHeight: 180, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 16, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink, backgroundColor: colors.white }}
          />
          <Text style={{ alignSelf: "flex-end", fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{body.length}/1,000</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable onPress={() => void pickPhoto()} style={{ flex: 1, minHeight: 116, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: colors.brand, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Camera size={28} color={colors.brand} />
            <Text style={{ fontFamily: fonts.semibold, color: colors.brandDeep }}>{photoUri ? "Change photo" : "Add photo or video"}</Text>
          </Pressable>
          {photoUri ? <MediaFrame uri={photoUri} label="Your experience photo" ratio={1} /> : null}
        </View>

        {error ? <StatusMessage kind="error" title="Not shared yet" detail={error} /> : null}
        <ActionButton label="Share Experience →" pending={busy} disabled={!body.trim()} onPress={() => void submit()} />
      </View>
    </AppShell>
  );
}

export function CommunityExperienceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const story = useQuery({ queryKey: ["community-experience", id], queryFn: () => community.experience(id!), enabled: !!id });
  const replies = useQuery({ queryKey: ["community-experience-replies", id], queryFn: () => community.entries(id!, "replies"), enabled: !!id });
  const updates = useQuery({ queryKey: ["community-experience-followups", id], queryFn: () => community.entries(id!, "followups"), enabled: !!id });
  const e = story.data;

  return (
    <AppShell back navigation notify title="Product Experience" ambient="socialNight">
      <View style={{ gap: 18 }}>
        {story.isLoading ? <ContentSkeleton rows={5} /> : null}
        {e ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PersonAvatar id={e.user_id} name={e.author_name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{e.author_name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{timeAgo(e.created_at)}</Text>
              </View>
              <Pressable><DotsThree size={22} color={colors.inkSoft} weight="bold" /></Pressable>
            </View>
            <View style={{ borderRadius: 24, overflow: "hidden" }}>
              <MediaFrame uri={e.photo_path} experiencePath={e.photo_path} label="Product experience" ratio={1.45} />
            </View>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 34, color: colors.ink }}>{e.unmask_catalog?.name || "Product"}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[e.skin_type, e.duration, e.frequency, e.context].filter(Boolean).map((x) => (
                <View key={x} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F4E7F1" }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.brandDeep }}>{x}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: colors.ink }}>{e.body}</Text>

            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.coral }}>♥ 1.4K</Text>
              <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>◯ {replies.data?.length || 0}</Text>
              <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>↗ Share</Text>
              <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>♡ Save</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton tone="secondary" label="Ask the Community" onPress={() => router.push(`/community-ask?product=${e.product_id}` as Href)} />
              <ActionButton label="Ask the Brand" onPress={() => router.push(`/community-ask?product=${e.product_id}` as Href)} />
            </View>

            <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>Comments ({replies.data?.length || 0})</Text>
            {replies.data?.map((r) => (
              <View key={r.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 8 }}>
                <PersonAvatar id={r.user_id} name={r.author_name || "Member"} size={36} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{r.author_name || "Member"}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink }}>{r.body}</Text>
                </View>
              </View>
            ))}
            {updates.data?.length ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>Journey updates</Text>
                {updates.data.map((u) => <Text key={u.id} style={{ fontFamily: fonts.regular, color: colors.ink }}>{u.body}</Text>)}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </AppShell>
  );
}
