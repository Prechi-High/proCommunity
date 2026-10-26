import { CreatorUpdates } from "@/components/unmask-ui/CreatorUpdates";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ActionButton,
  AppShell,
  EmptyState,
  FilterChips,
  SearchField,
  StatusMessage,
  StoryCard,
  StorySkeleton,
} from "@/components/unmask-ui";
import { Sparkle } from "@/components/icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "@/constants/theme";
import { loadUnmasks } from "@/lib/unmask/feed";
import { DemoBanner } from "@/components/unmask-ui/DemoBanner";
import { SAMPLE_FEED } from "@/lib/unmask/samples";
import { useAppStore } from "@/lib/store";
export default function Unmasks() {
  const router = useRouter();
  const demo = useAppStore((s) => s.demoCommunity);
  const [sort, setSort] = useState<"Recent" | "Most sparked">("Most sparked");
  const [filter, setFilter] = useState("Open");
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["unmasks", sort],
    queryFn: () => loadUnmasks(sort),
  });
  const rows = useMemo(() => {
    let out = demo
      ? SAMPLE_FEED.filter((i) => i.kind === "unmask")
      : (list.data ?? []);
    if (sort === "Most sparked")
      out = [...out].sort((a, b) => (b.sparks ?? 0) - (a.sparks ?? 0));
    if (filter === "Open")
      out = out.filter((i) => i.status === "Open for Sparks");
    if (filter === "In progress")
      out = out.filter(
        (i) => i.status === "Creator assigned" || i.status === "In the making",
      );
    if (filter === "Answers")
      out = out.filter((i) => i.status === "Ultra Unmasked");
    if (q.trim())
      out = out.filter((i) =>
        `${i.title} ${i.productName}`
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
      );
    return out;
  }, [list.data, filter, q, demo, sort]);
  return (
    <AppShell notify flush>
      <View style={{ gap: 20, paddingTop: 10 }}>
        <CreatorUpdates />
        <LinearGradient
          colors={["#55202D", "#311019"]}
          style={{
            marginHorizontal: 20,
            padding: 24,
            borderRadius: 26,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Sparkle size={22} color="#E8CD89" weight="fill" />
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 12,
                letterSpacing: 1,
                color: "#E8CD89",
              }}
            >
              ULTRA UNMASK
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.serifBold,
              fontSize: 34,
              lineHeight: 37,
              color: "#fff",
            }}
          >
            Don’t stop at{"\n"}“good” or “bad.”
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 15,
              lineHeight: 23,
              color: "#ECDADF",
            }}
          >
            Bring your question. Add Sparks. Help a creator explore why — and
            share what they find.
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingTop: 5,
            }}
          >
            {["Your story", "Community Sparks", "Creator answers"].map(
              (t, i) => (
                <View key={t} style={{ flex: 1, gap: 7 }}>
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 12,
                      color: "#D5B878",
                    }}
                  >
                    0{i + 1}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      lineHeight: 18,
                      color: "#fff",
                    }}
                  >
                    {t}
                  </Text>
                </View>
              ),
            )}
          </View>
        </LinearGradient>
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <DemoBanner />
          <ActionButton
            label="Request an Ultra Unmask"
            icon={<Sparkle size={20} color="#fff" />}
            onPress={() => router.push("/investigation/request")}
          />
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Find a product story"
          />
          <FilterChips
            options={["Open", "In progress", "Answers"]}
            value={filter}
            onChange={setFilter}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 18,
                color: colors.ink,
              }}
            >
              {filter === "Answers"
                ? "What we found"
                : filter === "In progress"
                  ? "Taking shape"
                  : "Ready for a closer look"}
            </Text>
          </View>
          <FilterChips
            variant="chips"
            options={["Most sparked", "Recent"]}
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
          />
        </View>
        {!demo && list.isLoading ? (
          <StorySkeleton />
        ) : !demo && list.isError ? (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <StatusMessage kind="error" title="Ultra Unmasks couldn’t load." />
            <ActionButton
              label="Try again"
              tone="secondary"
              onPress={() => void list.refetch()}
            />
          </View>
        ) : rows.length ? (
          rows.map((i) => <StoryCard key={i.id} item={i} flush />)
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <EmptyState
              title={
                q
                  ? "No matching stories yet."
                  : filter === "Answers"
                    ? "The next answer starts with a question."
                    : "What deserves a closer look?"
              }
              detail="A great result, a disappointment or something you can’t explain. It all belongs here."
              action="Ask your question"
              onAction={() => router.push("/investigation/request")}
            />
          </View>
        )}
      </View>
    </AppShell>
  );
}
