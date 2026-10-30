import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { UsersThree, Waveform } from "@/components/icons";
import { SpaceCard, SpacePill } from "@/components/room/SpaceCard";
import { AppShell } from "@/components/unmask-ui";
import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { fonts } from "@/constants/theme";
import { db } from "@/lib/clarity/api";
import { formatSchedule, roomProducts } from "@/lib/room/context";
import { useRoomDock } from "@/lib/room/dock";
import { useAppStore } from "@/lib/store";
import { useUnmaskTheme } from "@/lib/useUnmaskTheme";

type Creator = {
  display_name: string;
  handle: string;
  avatar_url: string | null;
  creator_mark: string;
};

type Session = {
  id: string;
  title: string;
  description: string;
  status: "live" | "scheduled";
  scheduled_at: string | null;
  started_at: string | null;
  host_creator_id: string | null;
  recording_status: string | null;
  metadata: unknown;
  creator: Creator | null;
};

const SAMPLE: Session[] = [
  {
    id: "sample-live",
    title: "Why this cleanser pills in humidity",
    description: "Owners compare texture, fragrance, and whether the tight feeling shows up after a week.",
    status: "live",
    scheduled_at: null,
    started_at: new Date().toISOString(),
    host_creator_id: "ada",
    recording_status: "recording",
    metadata: {
      participant_count: 18,
      active_speaker_count: 1,
      active_speaker_name: "Ada Mensah",
      product_name: "Hydrating Cleanser",
      product_brand: "CeraVe",
      topic: "Texture",
    },
    creator: { display_name: "Ada Mensah", handle: "ada", avatar_url: null, creator_mark: "creator-ada" },
  },
  {
    id: "sample-soon",
    title: "Night cream: worth the price?",
    description: "A scheduled listen on scent, pilling, and what people noticed after thirty days.",
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    started_at: null,
    host_creator_id: "bea",
    recording_status: "not_requested",
    metadata: { participant_count: 0, product_name: "Skin Renewing Night Cream", product_brand: "CeraVe", topic: "Price" },
    creator: { display_name: "Bea Okonkwo", handle: "bea", avatar_url: null, creator_mark: "creator-bea" },
  },
];

function creatorOf(row: { unmask_creators?: Creator | Creator[] | null }) {
  const value = row.unmask_creators;
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export default function RoomList() {
  const { colors } = useUnmaskTheme();
  const router = useRouter();
  const openRoom = useRoomDock((state) => state.open);
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const sample = preview === "1";
  const { width } = useWindowDimensions();
  const columns = width >= 760;
  const uid = useAppStore((state) => state.profile?.id);
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(!sample);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (sample) {
      setRows(SAMPLE);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: queryError } = await db()
          .from("unmask_realtime_sessions")
          .select("id,title,description,status,scheduled_at,started_at,host_creator_id,recording_status,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark)")
          .eq("mode", "room")
          .in("status", ["scheduled", "live"])
          .limit(20);
        if (queryError) throw new Error(queryError.message);
        if (!active) return;
        const next = ((data ?? []) as Array<Session & { unmask_creators?: Creator | Creator[] | null }>).map((row) => ({
          ...row,
          status: row.status === "live" ? "live" as const : "scheduled" as const,
          creator: creatorOf(row),
        }));
        next.sort((a, b) => {
          if (a.status !== b.status) return a.status === "live" ? -1 : 1;
          const aTime = Date.parse(a.status === "live" ? a.started_at || "" : a.scheduled_at || "");
          const bTime = Date.parse(b.status === "live" ? b.started_at || "" : b.scheduled_at || "");
          return a.status === "live" ? bTime - aTime : aTime - bTime;
        });
        setRows(next);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Rooms could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [attempt, sample]);

  const live = rows.filter((row) => row.status === "live");
  const scheduled = rows.filter((row) => row.status === "scheduled");

  function open(row: Session) {
    if (sample) {
      router.push((row.status === "live" ? "/room/session?preview=live" : "/room/session?preview=prejoin") as Href);
      return;
    }
    const isHost = !!uid && row.host_creator_id === uid;
    openRoom({ id: row.id, host: isHost });
  }

  return (
    <AppShell back title="Rooms" subtitle="Pause on a product and listen to the people who have used it.">
      <View style={{ gap: 18 }}>
        {sample ? (
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.goldSoft }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.honeyInk }}>
              Sample layout. These Rooms are not live discussions.
            </Text>
          </View>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
          A Room is a moderated discussion. The host and co-hosts hold the stage. Listeners can ask for the mic. The product stays in view.
        </Text>
        {loading ? <ContentSkeleton rows={3} /> : null}
        {!loading && error ? (
          <View style={{ gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.coralSoft }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.coral }}>Rooms could not be loaded.</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>{error}</Text>
            <QuietButton label="Try again" onPress={() => setAttempt((value) => value + 1)} colors={colors} />
          </View>
        ) : null}
        {!loading && !error && !rows.length ? (
          <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.stage, gap: 10 }}>
            <Waveform size={28} color={colors.brand} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, color: colors.ink }}>No Rooms yet.</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
              Creators open a Room when a product needs a shared listen. Nothing is live or scheduled right now.
            </Text>
            <QuietButton label="Meet the creators" onPress={() => router.push("/creators" as Href)} colors={colors} />
          </View>
        ) : null}
        {!loading && !error && live[0] ? (
          <SpacePill
            title={live[0].title}
            hostName={live[0].creator?.display_name || "Host"}
            count={Number((live[0].metadata as { participant_count?: number } | null)?.participant_count || 0)}
            onPress={() => open(live[0])}
          />
        ) : null}
        {!loading && !error && live.length ? (
          <Section title="Live now" colors={colors}>
            <CardGrid columns={columns}>
              {live.map((row) => {
                const product = roomProducts(row.metadata)[0];
                return (
                  <View key={row.id} style={{ flexGrow: 1, flexBasis: columns ? 320 : "100%" }}>
                    <SpaceCard
                      title={row.title}
                      hostName={row.creator?.display_name || "Unmask Creator"}
                      hostHandle={row.creator?.handle}
                      count={Number((row.metadata as { participant_count?: number } | null)?.participant_count || 0)}
                      product={product ? (product.brand ? `${product.brand} ${product.name}` : product.name) : undefined}
                      onPress={() => open(row)}
                    />
                  </View>
                );
              })}
            </CardGrid>
          </Section>
        ) : null}
        {!loading && !error && scheduled.length ? (
          <Section title="Scheduled" colors={colors}>
            <CardGrid columns={columns}>
              {scheduled.map((row) => {
                const product = roomProducts(row.metadata)[0];
                return (
                  <View key={row.id} style={{ flexGrow: 1, flexBasis: columns ? 320 : "100%" }}>
                    <SpaceCard
                      title={row.title}
                      hostName={row.creator?.display_name || "Unmask Creator"}
                      hostHandle={row.creator?.handle}
                      count={0}
                      product={product ? `${product.brand ? `${product.brand} ` : ""}${product.name} · ${formatSchedule(row.scheduled_at)}` : formatSchedule(row.scheduled_at)}
                      onPress={() => open(row)}
                    />
                  </View>
                );
              })}
            </CardGrid>
          </Section>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <UsersThree size={18} color={colors.inkSoft} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>
            A Room is a public discussion. Ultra is the separate path when one person's situation needs a deeper investigation.
          </Text>
        </View>
        <QuietButton label="See Live" onPress={() => router.push("/live" as Href)} colors={colors} />
      </View>
    </AppShell>
  );
}

function QuietButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: { stage: string; ink: string; line: string } }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.stage,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children, colors }: { title: string; children: ReactNode; colors: { ink: string } }) {
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.7, color: colors.ink }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function CardGrid({ columns, children }: { columns: boolean; children: ReactNode }) {
  return <View style={{ flexDirection: columns ? "row" : "column", flexWrap: "wrap", gap: 12 }}>{children}</View>;
}
