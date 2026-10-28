import { useRef, useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLinking from "expo-linking";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EvidencePicker } from "@/components/tracking/EvidencePicker";
import { ProductIdentity } from "@/components/community/ProductIdentity";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { ActionButton, ActionSheet, AppShell, StatusMessage, SearchField, MediaFrame, ContentSkeleton } from "@/components/unmask-ui";
import { Lightning, Package, ChatCircle, Files, Check, Heart, Question, ArrowRight, ShareNetwork, CaretDown } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import type { EvidenceSelection } from "@/lib/tracking/api";
import { searchCommunityProducts } from "@/lib/unmask/communitySearch";
import { useTrackingDraft } from "@/lib/tracking/draft";
import { memberIdentity } from "@/lib/membership";
import * as api from "@/lib/investigations/api";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import { hapticSaved, hapticSelect } from "@/lib/haptics";
import { useAppStore } from "@/lib/store";
const body = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };
const heading = { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, color: colors.ink };
const surface = { padding: 19, borderRadius: 24, backgroundColor: "#F7F4F2", gap: 14, borderWidth: 1, borderColor: "#EEE7E3" };
type TaggedProduct = { id: string; name: string; brand: string; category: string; image_url: string | null };
export default function RequestUnmask() {
  const p = useLocalSearchParams<{ product?: string; question?: string; experience?: string; q?: string; resumeGuest?: string }>();
  const r = useRouter(), qc = useQueryClient(), reduced = useReducedMotion();
  const profile = useAppStore(s => s.profile), uid = profile?.id;
  const key = p.experience || p.question || p.product || "new";
  const draft = useTrackingDraft(`unmask:ultra-composer:${uid || "guest"}:${key}`, {
    title: p.q || "", concern: "", productId: p.product || "", tagged: null as TaggedProduct | null,
    attachment: null as EvidenceSelection | null, angle: "Curious", step: 0,
  }, uid && p.resumeGuest ? `unmask:ultra-composer:guest:${p.resumeGuest}` : undefined);
  const d = draft.value, set = (v: Partial<typeof d>) => draft.setValue(old => ({ ...old, ...v }));
  const [picker, setPicker] = useState(false), [search, setSearch] = useState("");
  const [details, setDetails] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null), saving = useRef(false);
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => living.catalog() });
  const exact = useQuery({ queryKey: ["catalog", d.productId], queryFn: () => living.catalog(d.productId), enabled: !!d.productId });
  const matches = useQuery({ queryKey: ["ultra-product-search", search], queryFn: () => searchCommunityProducts(search), enabled: search.trim().length > 1 });
  const story = useQuery({ queryKey: ["clarity-experience", p.experience], queryFn: () => community.experience(p.experience!), enabled: !!p.experience });
  const member = useQuery({ queryKey: ["member-identity", uid], queryFn: () => memberIdentity(uid!), enabled: !!uid });
  const product = d.tagged || catalog.data?.find(x => x.id === d.productId) || exact.data?.[0];
  const items = search.trim().length > 1 ? matches.data?.map(x => ({ ...x, image_url: x.heroImageUrl || null })) : catalog.data;
  const valid = d.title.trim().length >= 10;
  async function submit() {
    if (!uid) {
      try { await draft.flush(); } catch { setError("Couldn’t keep your draft on this device. Please try again."); return; }
      const parts = Object.entries({ product: p.product, question: p.question, experience: p.experience, resumeGuest: key }).filter(([,v]) => !!v).map(([k,v]) => `${k}=${encodeURIComponent(v!)}`).join("&");
      r.push({ pathname: "/(auth)/sign-in", params: { returnTo: `/investigation/request?${parts}` } } as Href); return;
    }
    if (!valid || saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      if (product) await living.registerProduct({ id: product.id, name: product.name, brand: product.brand || "", category: product.category || "Product", heroImageUrl: product.image_url });
      const out = await api.create({ title: d.title.trim(), concern: d.concern.trim() || d.title.trim(), supporting_links: "", product_id: d.productId || null,
        attached_journey_id: d.attachment?.kind === "journey" ? d.attachment.id : null,
        attached_experience_id: d.attachment?.kind === "experience" ? d.attachment.id : null,
        question_id: p.question || null, experience_id: p.experience || null });
      setDone(out.id); hapticSaved(out.id);
      await draft.clear().catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ["home-feed"] });
      void qc.invalidateQueries({ queryKey: ["unmasks"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Your story didn’t post. Your draft is still here."); }
    finally { saving.current = false; setBusy(false); }
  }
  if (!draft.ready) return <AppShell back navigation title="Ultra Unmask"><ContentSkeleton /></AppShell>;
  if (done) return <AppShell back navigation title="Your story is out there.">
    <Animated.View entering={reduced ? undefined : ZoomIn.duration(280)} style={{ alignItems: "center", paddingVertical: 28, gap: 17 }}>
      <LinearGradient colors={["#F8E8B6", "#F0D9E2"]} style={{ width: 110, height: 110, borderRadius: 37, alignItems: "center", justifyContent: "center" }}><Lightning size={58} color={colors.brandDeep} weight="fill" /></LinearGradient>
      <Text accessibilityRole="header" style={{ ...heading, fontSize: 28, lineHeight: 34, textAlign: "center" }}>You’ve started something.</Text>
      <Text style={{ ...body, textAlign: "center" }}>Your Ultra Unmask is open for community Sparks. Share it with the people who want answers too.</Text>
    </Animated.View>
    <ActionButton label="See my Ultra Unmask" onPress={() => r.replace(`/investigation/${done}` as Href)} />
    <ActionButton tone="secondary" label="Share my story" icon={<ShareNetwork size={19} color={colors.ink} />} onPress={() => void Share.share({ message: `${d.title}\n${ExpoLinking.createURL(`/investigation/${done}`)}` }).catch(() => setError("Couldn’t open sharing. You can share from your story."))} />
    <Text style={{ ...body, fontSize: 13 }}>The editorial team selects stories and assigns creators. Posting opens support; it doesn’t mean a creator has been assigned yet.</Text>
    {error ? <StatusMessage kind="error" title={error} /> : null}
  </AppShell>;
  return <AppShell back navigation title="Ultra Unmask" subtitle="Your story. A closer look. Together." scrollResetKey={d.step}>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {["Your story", "Preview"].map((label, i) => <View key={label} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 16, backgroundColor: d.step === i ? "#F1E5EC" : "#F6F3F1" }}><View style={{ width: 23, height: 23, borderRadius: 8, backgroundColor: d.step >= i ? colors.brandDeep : "#D9D0CB", alignItems: "center", justifyContent: "center" }}>{d.step > i ? <Check size={13} color="#fff" /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#fff" }}>{i + 1}</Text>}</View><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>{label}</Text></View>)}
    </View>
    <Animated.View key={d.step} entering={reduced ? undefined : FadeIn.duration(180)} style={{ gap: 18 }}>
      {d.step === 0 ? <>
        <LinearGradient colors={["#4C1D32", "#2C1323"]} style={{ padding: 22, borderRadius: 26, gap: 11, overflow: "hidden" }}>
          <View pointerEvents="none" style={{ position: "absolute", right: -18, top: -16, width: 125, height: 125, borderRadius: 70, borderWidth: 1, borderColor: "#A1718744", alignItems: "center", justifyContent: "center" }}><Lightning size={60} weight="fill" color="#EBD39522" /></View>
          <Lightning size={26} weight="fill" color="#F2D25B" /><Text accessibilityRole="header" style={{ ...heading, fontSize: 27, lineHeight: 33, color: "#fff", maxWidth: 310 }}>Let’s get to the why.</Text><Text style={{ ...body, color: "#EAD9E1" }}>A great result. A let-down. A question you can’t shake. Bring it here and let the community take it further.</Text>
        </LinearGradient>
        <View style={surface}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Package size={21} color={colors.brandDeep} /><Text style={heading}>Which product is this about?</Text></View>
          {product ? <ProductIdentity name={product.name} brand={product.brand} image={product.image_url} /> : d.productId && exact.isLoading ? <ContentSkeleton rows={1} /> : <Text style={body}>Tag the product so people recognise it straight away.</Text>}
          <ActionButton tone="secondary" label={product ? "Change product" : "Tag a product"} icon={<Package size={18} color={colors.ink} />} onPress={() => setPicker(true)} />
          {!product ? <Text style={{ ...body, fontSize: 12 }}>Optional. You can still tell your story if you can’t find it.</Text> : null}
        </View>
        <View style={surface}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><MemberAvatar name={profile?.displayName || "You"} size={31} claimed={!!member.data} /><View style={{ flex: 1, gap: 2 }}><Text style={{ ...heading, fontSize: 16 }}>{profile?.displayName || "Your voice"}</Text><Text style={{ ...body, fontSize: 12 }}>Posting to the Unmask community</Text></View><ChatCircle size={22} color={colors.brandDeep} /></View>
          <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>{[{ label: "Loved it", Icon: Heart }, { label: "Let down", Icon: Lightning }, { label: "Curious", Icon: Question }].map(({ label, Icon }) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: d.angle === label }} onPress={() => { hapticSelect(); set({ angle: label }); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 42, borderRadius: 99, backgroundColor: d.angle === label ? colors.brandDeep : "#EDE6E9" }}><Icon size={16} color={d.angle === label ? "#fff" : colors.ink} /><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: d.angle === label ? "#fff" : colors.ink }}>{label}</Text></Pressable>)}</View>
          <Text style={heading}>What would you like to understand?</Text>
          <TextInput accessibilityLabel="My Ultra Unmask question" value={d.title} onChangeText={title => set({ title })} multiline maxLength={160} placeholder={d.angle === "Loved it" ? "This worked so well for me. Why—and who else could it help?" : d.angle === "Let down" ? "I expected something different. Why did this happen?" : "What’s the story behind this product?"} placeholderTextColor={colors.inkSoft} style={{ fontFamily: fonts.medium, fontSize: 21, lineHeight: 29, minHeight: 120, color: colors.ink, padding: 14, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5DADC", textAlignVertical: "top" }} />
          <Text style={{ ...body, fontSize: 11, textAlign: "right" }}>{d.title.length}/160</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: details ?? !!d.concern }} onPress={() => setDetails(!(details ?? !!d.concern))} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><CaretDown size={18} color={colors.ink} /><Text style={{ ...heading, fontSize: 15 }}>Add a little context <Text style={{ ...body, fontSize: 12 }}>(optional)</Text></Text></Pressable>
          {(details ?? !!d.concern) ? <TextInput accessibilityLabel="Extra context for my Ultra Unmask" value={d.concern} onChangeText={concern => set({ concern })} multiline maxLength={3000} placeholder="What happened? How did you use it? What would a useful answer look like?" placeholderTextColor={colors.inkSoft} style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, minHeight: 125, padding: 14, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5DADC", color: colors.ink, textAlignVertical: "top" }} /> : null}
        </View>
        <View style={surface}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Files size={22} color={colors.brandDeep} /><Text style={heading}>Bring your experience along.</Text></View><Text style={body}>Already shared an experience or kept a product timeline? Attach it so your story has context.</Text><EvidencePicker value={d.attachment} onChange={attachment => { set({ attachment }); if (!d.productId && attachment?.productId) set({ productId: attachment.productId }); }} buttonLabel="Attach an experience or timeline" /></View>
        {story.isLoading ? <ContentSkeleton rows={1} /> : story.data ? <View style={{ ...surface, backgroundColor: "#F3EAF0" }}><Text style={{ ...heading, fontSize: 15 }}>Your original experience is linked</Text><Text numberOfLines={3} style={body}>{story.data.body}</Text></View> : null}
        <ActionButton label="Preview my Ultra Unmask" disabled={!valid} icon={<ArrowRight size={19} color="#fff" />} onPress={() => { setError(""); set({ step: 1 }); }} />
        {!valid ? <Text style={{ ...body, fontSize: 12 }}>Write a question of at least 10 characters. A few clear words are enough.</Text> : null}
      </> : <>
        <View style={{ ...surface, backgroundColor: "#fff", borderColor: "#E6D5DF" }}>
          <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}><Lightning size={19} weight="fill" color={colors.brandDeep} /><Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.brandDeep }}>ULTRA UNMASK · PREVIEW</Text></View>
          {product ? <ProductIdentity name={product.name} brand={product.brand} image={product.image_url} /> : null}
          <Text style={{ ...heading, fontSize: 25, lineHeight: 33 }}>{d.title}</Text>{d.concern ? <Text style={body}>{d.concern}</Text> : null}
          {d.attachment ? <View style={{ padding: 14, borderRadius: 18, backgroundColor: "#F5EDF2", gap: 4 }}><Text style={{ ...heading, fontSize: 14 }}>Attached {d.attachment.kind === "journey" ? "product timeline" : "product experience"}</Text><Text style={body}>{d.attachment.title}</Text></View> : null}
          {p.experience ? <Text style={{ ...body, fontSize: 13 }}>Your original experience is linked.</Text> : null}
        </View>
        <View style={surface}><Text style={heading}>Here’s what happens next.</Text>{["Your story opens for community Sparks.", "The team selects stories and assigns creators.", "Creator findings and updates come back to the community."].map((line,i) => <View key={line} style={{ flexDirection: "row", gap: 9 }}><Text style={{ fontFamily: fonts.semibold, color: colors.brandDeep }}>{i+1}.</Text><Text style={{ ...body, flex: 1 }}>{line}</Text></View>)}</View>
        <Text style={{ ...body, fontSize: 13 }}>Your post and attached sources are public. Sparks support a closer look; they don’t guarantee selection, a company reply, or a particular finding.</Text>
        <ActionButton label="Post my Ultra Unmask" pending={busy} pendingLabel="Posting…" disabled={busy || !valid} icon={<Lightning size={19} color="#fff" weight="fill" />} onPress={() => void submit()} />
        <ActionButton tone="ghost" label="Keep editing" disabled={busy} onPress={() => set({ step: 0 })} />
      </>}
    </Animated.View>
    {error ? <StatusMessage kind="error" title="Your story hasn’t posted." detail={error} /> : null}
    <Text style={{ ...body, fontSize: 12 }}>Your draft saves on this device. Choosing a particular creator is coming later.</Text>
    <ActionSheet open={picker} onClose={() => setPicker(false)} title="Tag your product">
      <SearchField value={search} onChange={setSearch} placeholder="Search product name or brand" />
      {(search.trim().length > 1 ? matches.isLoading : catalog.isLoading) ? <ContentSkeleton /> : null}
      {(items || []).slice(0,15).map(x => <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`Tag ${x.name}`} onPress={() => { set({ productId: x.id, tagged: { id: x.id, name: x.name, brand: x.brand || "", category: x.category || "Product", image_url: x.image_url || null } }); setPicker(false); }} style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 18, backgroundColor: "#F8F5F2", alignItems: "center" }}><View style={{ width: 60 }}><MediaFrame uri={x.image_url} label={x.name} ratio={1} corners={false} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ ...heading, fontSize: 16 }}>{x.name}</Text><Text style={{ ...body, fontSize: 13 }}>{x.brand}</Text></View></Pressable>)}
      {(search.trim().length > 1 ? matches.isError : catalog.isError) ? <ActionButton tone="secondary" label="Retry products" onPress={() => void (search.trim().length > 1 ? matches.refetch() : catalog.refetch())} /> : null}
      {search.trim().length > 1 && matches.isSuccess && !items?.length ? <StatusMessage title="No match yet" detail="Try the name on the label. You can also tell your story without a product tag." /> : null}
    </ActionSheet>
  </AppShell>;
}
