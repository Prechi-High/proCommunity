import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import {
  Bell,
  BookmarkSimple,
  Buildings,
  Check,
  Clock,
  Drop,
  Leaf,
  ListBullets,
  Play,
  Ruler,
  Sparkle,
  Tag,
  UsersThree,
} from "@/components/icons";
import { fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import {
  hasUnmaskRevealed,
  markUnmaskRevealed,
} from "@/lib/unmask/revealSession";
import { startProductUnmask, type UnmaskJobProgress } from "@/lib/products";
import type { Product, ProductProfile } from "@/lib/types";
import type { JourneyClip } from "@/lib/videos";
import { summarizeReports, numericReportShare } from "@/lib/clarity/evidence";
import * as clarity from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import { dimensions, claimFor, dateLabel, evidenceRows } from "./data";
import { Evidence } from "./Evidence";
import { Questions } from "./Questions";
import {
  BottomNav,
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Header,
  Heading,
  Identity,
  LinkRow,
  Notice,
  Photo,
  Pill,
  identityLine,
  ink,
  openSource,
  s,
} from "./ui";

type Props = {
  product: Product;
  profile: ProductProfile | null;
  intelReady: boolean;
  intelLoading: boolean;
  intelError?: boolean;
  jobProgress?: UnmaskJobProgress | null;
  previewLoading?: boolean;
  clips: JourneyClip[];
  clipsLoading: boolean;
  onRetry: () => void;
  onStart: () => void;
  onAskCommunity: (q: string) => void;
  onSave: () => void;
  saved: boolean;
  onCompare: () => void;
  scanPhoto?: string | null;
};
export function ReferenceProductFlow(props: Props) {
  const {
    product,
    profile,
    intelReady,
    intelLoading,
    jobProgress,
    clips,
    onAskCommunity,
  } = props;
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((x) => x.profile?.id);
  const [phase, setPhase] = useState<"confirm" | "research" | "result">(
    hasUnmaskRevealed(product.id) ? "result" : "confirm",
  );
  const [tab, setTab] = useState("Overview");
  const [detail, setDetail] = useState<string | null>(null);
  const [skin, setSkin] = useState("All reports");
  const [error, setError] = useState("");
  const scroller = useRef<ScrollView>(null);
  const experiences = useQuery({
    queryKey: ["clarity-product", product.id],
    queryFn: () => clarity.experiences(false, product.id),
    enabled: phase === "result",
  });
  const journeyExperiences = useQuery({
    queryKey: ["public-product-experiences", product.id],
    queryFn: () => living.experiences({ productId: product.id }),
    enabled: phase === "result",
  });
  const native = useMemo(
    () => [
      ...(experiences.data || []),
      ...(journeyExperiences.data || []).map((e) => ({
        id: `journey:${e.id}`,
        user_id: e.user_id,
        product_id: e.product_id,
        author_name: e.author_name,
        duration: e.claimed_days
          ? `${e.claimed_days} days (self-reported)`
          : "Not stated",
        body: [e.changed, e.unchanged, e.reaction].filter(Boolean).join(" "),
        uncertainty: e.uncertainty || "",
        context: e.context || "",
        skin_type: null,
        acquisition: e.acquisition,
        usage_status: e.product_status,
        would_rebuy:
          e.would_rebuy == null ? "Not stated" : String(e.would_rebuy),
        visibility: "public" as const,
        created_at: e.created_at,
      })),
    ],
    [experiences.data, journeyExperiences.data],
  );
  const subscriptions = useQuery({
    queryKey: ["subscriptions"],
    queryFn: living.subscriptions,
    enabled: !!uid,
  });
  const linkedProduct = useQuery({
    queryKey: ["catalog-product", product.id],
    queryFn: () => living.catalog(product.id),
    enabled: tab === "Company",
  });
  const companyId = linkedProduct.data?.[0]?.company_id;
  const companyInfo = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => living.company(companyId!),
    enabled: !!companyId,
  });
  const companyProducts = useQuery({
    queryKey: ["company-products", companyId],
    queryFn: () => living.companyProducts(companyId!),
    enabled: !!companyId,
  });
  const targetType = tab === "Company" ? "company" : "product";
  const targetId = tab === "Company" ? companyId : product.id;
  const following = subscriptions.data?.some(
    (x) => x.target_type === targetType && x.target_id === targetId,
  );
  const [followBusy, setFollowBusy] = useState(false);
  const follow = async () => {
    if (!uid) {
      r.push("/(auth)/sign-in");
      return;
    }
    setFollowBusy(true);
    setError("");
    try {
      await living.registerProduct(product);
      const currentId =
        targetId || (await living.catalog(product.id))[0]?.company_id;
      if (!currentId)
        throw new Error("The company relationship is not available yet.");
      if (following) await living.unfollow(targetType, currentId);
      else await living.follow(targetType, currentId);
      void qc.invalidateQueries({ queryKey: ["catalog-product", product.id] });
      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to follow. Please retry.",
      );
    } finally {
      setFollowBusy(false);
    }
  };
  useEffect(() => {
    if (phase === "research" && intelReady) {
      markUnmaskRevealed(product.id);
      setPhase("result");
    }
  }, [phase, intelReady, product.id]);
  useEffect(() => {
    setPhase(hasUnmaskRevealed(product.id) ? "result" : "confirm");
    setTab("Overview");
    setDetail(null);
  }, [product.id]);
  const change = (t: string) => {
    setTab(t);
    setDetail(null);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };
  const start = () => {
    props.onStart();
    if (intelReady) {
      markUnmaskRevealed(product.id);
      setPhase("result");
    } else {
      setPhase("research");
      void startProductUnmask({ id: product.id, query: product.name }).catch(
        () => setError("Unable to start research. Please retry."),
      );
    }
  };
  const back = () => {
    if (detail) {
      setDetail(null);
      return;
    }
    if (tab === "Company" && phase === "confirm") {
      setTab("Overview");
      return;
    }
    if (r.canGoBack()) r.back();
    else r.replace("/unmask");
  };
  const showResult = phase === "result";
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <Header
        onBack={back}
        right={
          showResult && tab === "Overview" ? (
            <Pressable
              accessibilityLabel={
                props.saved ? "Remove saved product" : "Save product"
              }
              onPress={props.onSave}
              style={{ padding: 10 }}
            >
              <BookmarkSimple
                size={25}
                color={ink.brand}
                weight={props.saved ? "fill" : "regular"}
              />
            </Pressable>
          ) : showResult || tab === "Company" ? (
            <Button
              quiet
              disabled={followBusy}
              label={
                following
                  ? "Following"
                  : tab === "Company"
                    ? "Follow company"
                    : "Follow"
              }
              onPress={() => void follow()}
              icon={<Bell size={16} color={ink.brand} />}
            />
          ) : phase === "confirm" ? (
            <Pressable
              onPress={() =>
                r.replace(
                  ("/results?q=" + encodeURIComponent(product.name)) as Href,
                )
              }
            >
              <Copy small>Change product</Copy>
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {error ? <Notice>{error}</Notice> : null}
        {phase === "confirm" && tab !== "Company" ? (
          <>
            <View
              style={{ alignItems: "center", paddingVertical: 10, gap: 10 }}
            >
              <Photo
                uri={
                  product.heroImageUrl ||
                  profile?.images?.[0] ||
                  props.scanPhoto
                }
                size={255}
              />
              <Copy muted>Selected product</Copy>
            </View>
            <View style={{ alignItems: "center", gap: 7 }}>
              <Heading hero>Confirm this product</Heading>
              <Copy muted>We’ll investigate this exact version.</Copy>
            </View>
            <Card>
              {[
                [
                  ListBullets,
                  "Product",
                  profile?.identity.name || product.name,
                ],
                [Tag, "Brand", product.brand || "Not yet identified"],
                [
                  Ruler,
                  "Size and market",
                  [
                    profile?.identity.size,
                    profile?.specs.find((x) => /market|country/i.test(x.label))
                      ?.value,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Not yet confirmed",
                ],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Tag;
                return (
                  <View
                    key={String(label)}
                    style={[s.row, { paddingVertical: 9 }]}
                  >
                    <I size={28} color={ink.brand} />
                    <View style={{ flex: 1, gap: 5 }}>
                      <Copy small>{String(label)}</Copy>
                      <Copy>{String(value)}</Copy>
                    </View>
                  </View>
                );
              })}
            </Card>
            <LinkRow
              label={`About ${product.brand || "the company"}`}
              icon={<Buildings size={24} color={ink.brand} />}
              onPress={() => setTab("Company")}
            />
            <Button
              label="Start Unmasking"
              onPress={start}
              disabled={props.previewLoading && !profile}
            />
            <Copy small>
              You can change the match if something looks wrong.
            </Copy>
          </>
        ) : null}
        {phase === "research" ? (
          <Research
            product={product}
            profile={profile}
            job={jobProgress}
            loading={intelLoading}
            clipsLoading={props.clipsLoading}
            clipsCount={clips.length}
            error={props.intelError || jobProgress?.state === "failed"}
            retry={props.onRetry}
          />
        ) : null}
        {(showResult || tab === "Company") && profile ? (
          <>
            {tab !== "Company" ? (
              <Identity product={product} profile={profile} />
            ) : null}
            {showResult && tab !== "Overview" ? (
              <View
                style={{
                  marginHorizontal: -16,
                  borderBottomWidth: 1,
                  borderColor: ink.line,
                }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
                >
                  {[
                    "Overview",
                    "Evidence",
                    "Claims",
                    "Timeline",
                    "Questions",
                    "Company",
                  ].map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => change(t)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === t }}
                      style={{
                        paddingHorizontal: 6,
                        paddingTop: 8,
                        paddingBottom: 12,
                        borderBottomWidth: tab === t ? 2 : 0,
                        borderColor: ink.brand,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily:
                            tab === t ? fonts.semibold : fonts.regular,
                          fontSize: 13,
                          color: tab === t ? ink.brand : ink.muted,
                        }}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {detail ? (
              <CategoryDetail
                profile={profile}
                id={detail}
                skin={skin}
                setSkin={setSkin}
                onSources={() => change("Evidence")}
              />
            ) : (
              <>
                {tab === "Overview" ? (
                  <Overview
                    product={product}
                    profile={profile}
                    skin={skin}
                    setSkin={setSkin}
                    clips={clips}
                    onCategory={setDetail}
                    onEvidence={() => change("Evidence")}
                    onAsk={() => change("Questions")}
                    saved={props.saved}
                    onSave={props.onSave}
                    onCompare={props.onCompare}
                  />
                ) : null}
                {tab === "Evidence" ? (
                  <>
                    <Busy
                      loading={
                        experiences.isLoading || journeyExperiences.isLoading
                      }
                      error={experiences.error || journeyExperiences.error}
                      retry={() => {
                        void experiences.refetch();
                        void journeyExperiences.refetch();
                      }}
                    />
                    <Evidence
                      profile={profile}
                      native={native}
                      onAsk={() => change("Questions")}
                    />
                  </>
                ) : null}
                {tab === "Claims" ? <Claims profile={profile} /> : null}
                {tab === "Timeline" ? (
                  <Timeline profile={profile} native={native} />
                ) : null}
                {tab === "Questions" ? (
                  <Questions profile={profile} onCommunity={onAskCommunity} />
                ) : null}
                {tab === "Company" ? (
                  <Company
                    company={companyInfo.data}
                    catalogue={companyProducts.data}
                    product={product}
                    profile={profile}
                    onEvidence={() => {
                      if (!intelReady) {
                        setTab("Overview");
                        start();
                        return;
                      }
                      setPhase("result");
                      change("Evidence");
                    }}
                  />
                ) : null}
              </>
            )}
          </>
        ) : null}
        {(showResult || tab === "Company") && !profile ? (
          <Busy
            loading={intelLoading || props.previewLoading}
            error={
              props.intelError ? "Unable to load product information" : null
            }
            retry={props.onRetry}
          />
        ) : null}
      </ScrollView>
      {showResult ? <BottomNav /> : null}
    </SafeAreaView>
  );
}
function Research({
  product,
  profile,
  job,
  loading,
  clipsLoading,
  clipsCount,
  error,
  retry,
}: {
  product: Product;
  profile: ProductProfile | null;
  job?: UnmaskJobProgress | null;
  loading: boolean;
  clipsLoading: boolean;
  clipsCount: number;
  error?: boolean;
  retry: () => void;
}) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 6000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);
  const state = job?.state;
  const idx =
    state === "queued"
      ? 0
      : state === "identified"
        ? 1
        : state === "researching"
          ? 2
          : state === "mapping"
            ? 3
            : state === "scoring"
              ? 4
              : state === "ready"
                ? 5
                : 0;
  const stages = [
    "Confirming product details",
    "Checking company information",
    "Finding public product experiences",
    "Reviewing available videos",
    "Organising your evidence",
  ];
  return (
    <>
      <Card>
        <Identity product={product} profile={profile} />
      </Card>
      <View style={{ alignItems: "center", gap: 10, paddingTop: 10 }}>
        <Heading hero>Looking beneath the surface</Heading>
        <Copy muted>
          We’re gathering available information and experiences for your
          overview.
        </Copy>
        <View
          style={{
            height: 230,
            width: 230,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              width: 222,
              height: 222,
              borderRadius: 111,
              borderWidth: 1,
              borderColor: ink.line,
              borderTopColor: ink.brand,
              borderRightColor: ink.brand,
              transform: [
                {
                  rotate: rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            }}
          />
          <Animated.View
            style={{
              position: "absolute",
              width: 176,
              height: 176,
              borderRadius: 88,
              borderWidth: 1,
              borderColor: ink.line,
              borderBottomColor: ink.brand,
              transform: [
                {
                  rotate: rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["360deg", "0deg"],
                  }),
                },
              ],
            }}
          />
          <Photo uri={product.heroImageUrl} size={100} />
        </View>
      </View>
      {error ? (
        <Notice>
          Research didn’t finish.{" "}
          <Text onPress={retry} style={{ color: ink.brand }}>
            Try again
          </Text>
        </Notice>
      ) : null}
      {stages.map((t, i) => (
        <View key={t} style={[s.row, { paddingVertical: 9 }]}>
          <View
            style={{
              width: 33,
              height: 33,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: i <= idx ? ink.brand : ink.line,
              backgroundColor: i < idx ? ink.brand : "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i < idx ? (
              <Check size={19} color="#FFFFFF" />
            ) : i === idx && !error ? (
              <ActivityIndicator size="small" color={ink.brand} />
            ) : (
              <Play size={17} color={ink.muted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Copy muted={i > idx}>{t}</Copy>
            {i > idx ? <Copy small>up next</Copy> : null}
          </View>
        </View>
      ))}
      <View style={s.rule} />
      <Copy muted>We’ll show what’s available and flag what’s missing.</Copy>
    </>
  );
}
function Overview({
  product,
  profile,
  skin,
  setSkin,
  clips,
  onCategory,
  onEvidence,
  onAsk,
  saved,
  onSave,
  onCompare,
}: {
  product: Product;
  profile: ProductProfile;
  skin: string;
  setSkin: (s: string) => void;
  clips: JourneyClip[];
  onCategory: (id: string) => void;
  onEvidence: () => void;
  onAsk: () => void;
  saved: boolean;
  onSave: () => void;
  onCompare: () => void;
}) {
  const dims = dimensions(profile);
  const company = profile.findings?.claims.filter(
    (c) => c.claimOrigin === "brand",
  );
  return (
    <>
      <Card>
        <Heading hero>At a glance</Heading>
        <Copy muted>
          {profile.consensus ||
            profile.summary ||
            "Available evidence is still developing."}
        </Copy>
        {dims.map((d, i) => {
          const summary = d.reports
            ? summarizeReports(
                d.reports.items,
                skin === "All reports" ? "All" : skin,
              )
            : null;
          const pct =
            d.reports && summary
              ? numericReportShare(summary, d.reports)
              : null;
          const Icon = i === 0 ? Drop : i === 1 ? Leaf : ListBullets;
          return (
            <Pressable
              key={d.id}
              onPress={() => onCategory(d.id)}
              accessibilityRole="button"
              style={[
                s.row,
                {
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderColor: ink.line,
                },
              ]}
            >
              <Icon size={27} color={ink.brand} />
              <View style={{ flex: 1, gap: 5 }}>
                <Copy>{d.label}</Copy>
                <Text
                  style={[
                    s.body,
                    { color: pct === null ? ink.muted : ink.brand },
                  ]}
                >
                  {pct === null
                    ? summary?.total
                      ? "Early signal"
                      : "Limited evidence"
                    : `${pct}% positive`}
                </Text>
              </View>
              <View style={{ width: "47%", gap: 5 }}>
                <View
                  style={{
                    height: 9,
                    borderRadius: 99,
                    backgroundColor: ink.line,
                    overflow: "hidden",
                  }}
                >
                  {pct !== null ? (
                    <View
                      style={{
                        width: `${pct}%`,
                        height: 9,
                        backgroundColor: ink.brand,
                      }}
                    />
                  ) : null}
                </View>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Copy small>0%</Copy>
                  <Copy small>100%</Copy>
                </View>
                <Copy small>
                  {summary?.total
                    ? `${summary.positive} of ${summary.total} eligible reports`
                    : "No eligible percentage yet"}
                </Copy>
              </View>
            </Pressable>
          );
        })}
        {!dims.length ? (
          <Notice>No traceable category findings are available yet.</Notice>
        ) : null}
        <Copy small>
          Percent refers to positive reports within each category, not a product
          rating or a measure of efficacy.
        </Copy>
      </Card>
      <Card>
        <Heading>What’s said vs. what people report</Heading>
        <View style={[s.row, { alignItems: "stretch" }]}>
          <View
            style={{
              flex: 1,
              gap: 7,
              backgroundColor: ink.soft,
              padding: 12,
              borderRadius: 10,
            }}
          >
            <Buildings size={24} color={ink.brand} />
            <Copy>Company says</Copy>
            <Copy small>
              {company?.[0]?.brandStatement ||
                "No sourced company statement is available."}
            </Copy>
          </View>
          <View
            style={{
              flex: 1,
              gap: 7,
              backgroundColor: ink.soft,
              padding: 12,
              borderRadius: 10,
            }}
          >
            <UsersThree size={24} color={ink.muted} />
            <Copy>People report</Copy>
            <Copy small>
              {dims[0]?.reports?.finding ||
                dims[0]?.takeaway ||
                "Explore the available evidence and its context."}
            </Copy>
          </View>
        </View>
        <View style={s.rule} />
        <Copy small>
          Use duration and personal context may be missing from external
          discussion.
        </Copy>
      </Card>
      <Card>
        <Heading>Personalise for your skin</Heading>
        <Chips
          options={[
            "All reports",
            "Dry",
            "Oily",
            "Combination",
            "Normal",
            "Sensitive",
          ]}
          value={skin}
          onChange={setSkin}
        />
        <Copy small>
          Only explicitly disclosed context is matched. Missing context is never
          inferred.
        </Copy>
      </Card>
      <View style={s.row}>
        <Button
          quiet
          label="Explore all evidence"
          onPress={onEvidence}
          style={{ flex: 1 }}
        />
        <Button label="Ask Unmask" onPress={onAsk} style={{ flex: 1 }} />
      </View>
      <VideoResources clips={clips} />
      <View style={s.row}>
        <Button
          quiet
          label={saved ? "Saved product" : "Save product"}
          onPress={onSave}
          style={{ flex: 1 }}
        />
        <Button quiet label="Compare" onPress={onCompare} style={{ flex: 1 }} />
      </View>
    </>
  );
}
function CategoryDetail({
  profile,
  id,
  skin,
  setSkin,
  onSources,
}: {
  profile: ProductProfile;
  id: string;
  skin: string;
  setSkin: (s: string) => void;
  onSources: () => void;
}) {
  const d = dimensions(profile).find((d) => d.id === id);
  if (!d) return <Notice>This category is not available.</Notice>;
  const summary = d.reports
    ? summarizeReports(d.reports.items, skin === "All reports" ? "All" : skin)
    : null;
  const pct =
    summary && d.reports ? numericReportShare(summary, d.reports) : null;
  return (
    <>
      <Heading hero>{d.label} evidence</Heading>
      <Copy muted>
        What eligible reports say about {d.label.toLowerCase()}.
      </Copy>
      <Card>
        <View style={s.row}>
          <Drop size={40} color={ink.brand} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 52,
                color: ink.brand,
              }}
            >
              {pct === null ? "Limited" : `${pct}%`}
            </Text>
            <Copy>positive reports</Copy>
            <Copy small>
              {summary?.positive || 0} of {summary?.total || 0} eligible reports
            </Copy>
          </View>
        </View>
        <View
          style={{
            height: 12,
            backgroundColor: ink.line,
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          {pct !== null ? (
            <View
              style={{
                width: `${pct}%`,
                height: 12,
                backgroundColor: ink.brand,
              }}
            />
          ) : null}
        </View>
        <Copy small>
          {summary?.mixed || 0} mixed · {summary?.negative || 0} negative
        </Copy>
        <Notice>
          This is the share of eligible reports that were positive. It is not a
          measure of product effectiveness.
        </Notice>
      </Card>
      <Card>
        <Heading>By skin type</Heading>
        <Chips
          options={[
            "All reports",
            "Dry",
            "Oily",
            "Combination",
            "Normal",
            "Sensitive",
          ]}
          value={skin}
          onChange={setSkin}
        />
        <Copy>
          {pct === null
            ? "Not enough eligible matching reports for a percentage."
            : `${pct}% of the eligible matching reports are positive.`}
        </Copy>
        <Pill warning>
          {summary?.total && summary.total < 20
            ? "Small sample"
            : "Context is self-reported"}
        </Pill>
        <View style={s.rule} />
        <Copy small>
          {summary?.unknown || 0} eligible reports do not disclose skin type.
        </Copy>
      </Card>
      <Card>
        <Heading>Where this evidence comes from</Heading>
        <Copy>External sources</Copy>
        <Copy small>
          Traceable statements from public comments and discussions.
        </Copy>
        <Copy>{d.reports?.finding || d.takeaway}</Copy>
        <Button
          quiet
          label={`View the ${summary?.total || 0} source reports`}
          onPress={onSources}
        />
      </Card>
    </>
  );
}
function VideoResources({ clips }: { clips: JourneyClip[] }) {
  const [tag, setTag] = useState("All");
  const opts = [
    "All",
    "How to use",
    "Ingredients",
    "Reviews",
    "Results over time",
  ];
  const key: Record<string, string> = {
    "How to use": "how_to_use",
    Ingredients: "composition",
    Reviews: "personal_experience",
    "Results over time": "results_over_time",
  };
  const shown =
    tag === "All"
      ? clips
      : clips.filter(
          (c) =>
            c.contentTags.includes(key[tag] as never) ||
            c.title.toLowerCase().includes(tag.toLowerCase()),
        );
  return (
    <Card>
      <Heading>Video resources</Heading>
      <Chips options={opts} value={tag} onChange={setTag} />
      {shown.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => openSource(c.sourceUrl)}
          style={s.row}
        >
          <Photo uri={c.thumbnailUrl} size={90} />
          <View style={{ flex: 1, gap: 6 }}>
            <Copy>{c.title}</Copy>
            <Copy small>
              {c.author} · {c.platform}
            </Copy>
          </View>
          <Play size={20} color={ink.brand} />
        </Pressable>
      ))}
      {!shown.length ? (
        <Copy small>No video resources in this category yet.</Copy>
      ) : null}
    </Card>
  );
}
function Claims({ profile }: { profile: ProductProfile }) {
  return (
    <>
      <Heading hero>Product facts and claims</Heading>
      <Copy muted>
        Company statements remain separate from independent evidence.
      </Copy>
      {profile.findings?.claims.map((c) => (
        <Card key={c.id}>
          <Pill>
            {c.claimOrigin === "brand"
              ? "COMPANY-PROVIDED CLAIM"
              : "WHAT PEOPLE DISCUSS"}
          </Pill>
          <Heading>{c.topic}</Heading>
          <Copy>{c.brandStatement || c.findingLabel}</Copy>
          <Copy small>{c.conditions || "Conditions not provided."}</Copy>
          {c.brandSourceId != null ? (
            <Button
              quiet
              label="View claim source"
              onPress={() =>
                openSource(
                  profile.sources.find((s) => s.n === c.brandSourceId)?.url,
                )
              }
            />
          ) : null}
        </Card>
      ))}
      {profile.specs.map((x, i) => (
        <Card key={i}>
          <Heading>{x.label}</Heading>
          <Copy>{x.value}</Copy>
          {x.source != null ? (
            <Pressable
              onPress={() =>
                openSource(profile.sources.find((s) => s.n === x.source)?.url)
              }
            >
              <Copy small>View source</Copy>
            </Pressable>
          ) : null}
        </Card>
      ))}
      {!profile.specs.length && !profile.findings?.claims.length ? (
        <Notice>No sourced facts or claims have been returned yet.</Notice>
      ) : null}
      {profile.howToUse ? (
        <Card>
          <Heading>Directions</Heading>
          <Copy>{profile.howToUse}</Copy>
        </Card>
      ) : null}
    </>
  );
}
function Timeline({
  profile,
  native,
}: {
  profile: ProductProfile;
  native: clarity.Experience[];
}) {
  const [filter, setFilter] = useState("All sources");
  const external = evidenceRows(profile).filter((x) => x.createdAt);
  return (
    <>
      <Heading hero>Evidence timeline</Heading>
      <Copy muted>See how reports have developed over time.</Copy>
      <Notice>
        Post date shows when discussion appeared. Usage duration is reported by
        the person sharing it.
      </Notice>
      <Chips
        options={["All sources", "External", "Community"]}
        value={filter}
        onChange={setFilter}
      />
      {filter !== "Community"
        ? external.map((x) => (
            <Card key={x.evidenceId}>
              <Copy small>{dateLabel(x.createdAt)}</Copy>
              <Pill>EXTERNAL · {x.platform.toUpperCase()}</Pill>
              <Copy>{x.statement}</Copy>
              <Copy small>Use duration: not stated</Copy>
              <Button
                quiet
                label="View original discussion"
                onPress={() => openSource(x.url)}
              />
            </Card>
          ))
        : null}
      {filter !== "External"
        ? native.map((x) => (
            <Card key={x.id}>
              <Copy small>{dateLabel(x.created_at)}</Copy>
              <Pill>UNMASK COMMUNITY EXPERIENCE</Pill>
              <Copy>{x.body}</Copy>
              <Copy small>
                Use duration: {x.duration || "Not stated"} ·{" "}
                {x.skin_type || "Skin not disclosed"}
              </Copy>
            </Card>
          ))
        : null}
      {!external.length && !native.length ? (
        <Notice>No dated reports are available for this product yet.</Notice>
      ) : null}
    </>
  );
}
function Company({
  product,
  profile,
  onEvidence,
  company,
  catalogue,
}: {
  product: Product;
  profile: ProductProfile;
  onEvidence: () => void;
  company?: import("@/lib/living/types").Company | null;
  catalogue?: import("@/lib/living/types").LivingProduct[];
}) {
  const router = useRouter();
  const brandSourceId = profile.findings?.claims.find(
    (c) => c.claimOrigin === "brand" && c.brandSourceId != null,
  )?.brandSourceId;
  const source =
    profile.sources.find((s) => s.n === brandSourceId) ||
    profile.sources.find(
      (s) =>
        s.kind === "official" ||
        s.kind === "brand" ||
        s.kind === "manufacturer",
    );
  const known = useAppStore((x) => x.knownProducts);
  const products =
    catalogue?.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      category: p.category || "",
      heroImageUrl: p.image_url,
    })) ||
    Object.values(known).filter(
      (p) => p.brand.toLowerCase() === product.brand.toLowerCase(),
    );
  return (
    <>
      <Pill>Company behind this product</Pill>
      <Heading hero>
        {product.brand ||
          profile.identity.manufacturer ||
          "Company not identified"}
      </Heading>
      <Copy muted>{company?.description || product.category}</Copy>
      {company?.website ? (
        <Button
          quiet
          label="Official website"
          onPress={() => openSource(company.website)}
        />
      ) : null}
      {source ? (
        <>
          <Button
            quiet
            label="Official website"
            onPress={() => openSource(source.url)}
          />
          <Pill>OFFICIAL SOURCE LINKED</Pill>
        </>
      ) : null}
      <Card>
        <Heading>Company information</Heading>
        <View style={s.row}>
          <Tag size={23} color={ink.muted} />
          <Copy>Product category</Copy>
          <Copy muted>{product.category}</Copy>
        </View>
        <View style={s.rule} />
        <Copy>Official source</Copy>
        <Copy muted>
          {source?.domain || "An official source has not been verified."}
        </Copy>
      </Card>
      <Card>
        <Heading>Products from {product.brand || "this company"}</Heading>
        <ScrollView horizontal contentContainerStyle={{ gap: 14 }}>
          {products.map((p) => (
            <Pressable
              key={p.id}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: p.id, q: p.name },
                } as Href)
              }
              style={{ width: 110, gap: 7 }}
            >
              <Photo uri={p.heroImageUrl} size={105} />
              <Copy small>{p.name}</Copy>
            </Pressable>
          ))}
        </ScrollView>
      </Card>
      <Card>
        <Heading>Company claims</Heading>
        {profile.findings?.claims
          .filter((c) => c.claimOrigin === "brand")
          .map((c) => (
            <View key={c.id} style={{ gap: 8, paddingVertical: 8 }}>
              <Pill>COMPANY-PROVIDED CLAIM</Pill>
              <Copy>{c.brandStatement}</Copy>
              {c.brandSourceId != null ? (
                <Button
                  quiet
                  label="View claim source"
                  onPress={() =>
                    openSource(
                      profile.sources.find((s) => s.n === c.brandSourceId)?.url,
                    )
                  }
                />
              ) : null}
            </View>
          ))}
        {!profile.findings?.claims.some((c) => c.claimOrigin === "brand") ? (
          <Copy muted>No sourced company claims are available yet.</Copy>
        ) : null}
      </Card>
      <Card>
        <Heading>Independent discussion</Heading>
        <Copy muted>
          Explore external comments and Unmask community experiences with their
          source labels.
        </Copy>
        <Button quiet label="Explore product evidence" onPress={onEvidence} />
      </Card>
    </>
  );
}
