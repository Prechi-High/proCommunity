import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  ChatCircle,
  CaretRight,
  Clock,
  ArrowBendUpLeft,
  SlidersHorizontal,
  UsersThree,
  YoutubeLogo,
} from "@/components/icons";
import { fonts } from "@/constants/theme";
import type { ProductProfile } from "@/lib/types";
import type { DimensionEvidenceItem } from "@/lib/unmask/dimensionEvidence";
import type { Experience } from "@/lib/clarity/api";
import {
  Card,
  Chips,
  Copy,
  Heading,
  LinkRow,
  Notice,
  Pill,
  ink,
  openSource,
  s,
} from "./ui";
import { dateLabel, dimensions, evidenceRows } from "./data";
export function Evidence({
  profile,
  native,
  onAsk,
}: {
  profile: ProductProfile;
  native: Experience[];
  onAsk: () => void;
}) {
  const dims = dimensions(profile);
  const topics = [
    ...new Set([
      ...dims.map((d) => d.label),
      ...(profile.voices || []).map((v) => v.topic).filter(Boolean),
    ]),
  ];
  const [topic, setTopic] = useState(topics[0] || "All");
  const [filters, setFilters] = useState(false);
  const [source, setSource] = useState("All sources");
  const [sort, setSort] = useState("Most relevant");
  const external = evidenceRows(profile, topic);
  const nativeMatched = native.filter(
    (x) =>
      topic === "All" ||
      [x.body, x.context, x.uncertainty].some((v) =>
        v?.toLowerCase().includes(topic.toLowerCase()),
      ),
  );
  const entries = useMemo(() => {
    const out: Array<
      | { kind: "external"; item: DimensionEvidenceItem }
      | { kind: "community"; item: Experience }
    > = [];
    for (let i = 0; i < Math.max(external.length, nativeMatched.length); i++) {
      if (external[i] && source !== "Community")
        out.push({ kind: "external", item: external[i] });
      if (nativeMatched[i] && source !== "External")
        out.push({ kind: "community", item: nativeMatched[i] });
    }
    if (sort === "Newest first")
      out
        .sort(
          (a, b) =>
            new Date(
              a.kind === "external" ? a.item.createdAt || 0 : a.item.created_at,
            ).getTime() -
            new Date(
              b.kind === "external" ? b.item.createdAt || 0 : b.item.created_at,
            ).getTime(),
        )
        .reverse();
    return out;
  }, [external, nativeMatched, source, sort]);
  // Replies are rendered under their parent, never double-counted as standalone cards.
  const replyIds = new Set(
    external
      .filter(
        (x) => x.parentId && external.some((p) => p.evidenceId === x.parentId),
      )
      .map((x) => x.evidenceId),
  );
  return (
    <>
      <Heading hero>Evidence</Heading>
      <Copy muted>
        Experiences from external discussions and the Unmask community.
      </Copy>
      <Notice>Different sources, one view. Source labels stay visible.</Notice>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Chips
            options={topics.length ? topics : ["All"]}
            value={topic}
            onChange={setTopic}
          />
        </View>
        <Pressable
          accessibilityLabel="Evidence filters"
          onPress={() => setFilters(!filters)}
          style={[
            s.row,
            {
              borderWidth: 1,
              borderColor: ink.line,
              borderRadius: 99,
              padding: 10,
            },
          ]}
        >
          <SlidersHorizontal size={19} color={ink.text} />
          <Copy small>Filters</Copy>
        </Pressable>
      </View>
      {filters ? (
        <Card>
          <Copy>Source</Copy>
          <Chips
            options={["All sources", "External", "Community"]}
            value={source}
            onChange={setSource}
          />
          <Copy small>
            Only evidence explicitly linked to the selected topic is shown.
          </Copy>
        </Card>
      ) : null}
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Copy small>
          Showing{" "}
          {
            entries.filter(
              (e) => e.kind === "community" || !replyIds.has(e.item.evidenceId),
            ).length
          }{" "}
          signals · {source === "All sources" ? "External + community" : source}
        </Copy>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setSort(sort === "Most relevant" ? "Newest first" : "Most relevant")
          }
        >
          <View style={s.row}>
            <Copy small>{sort}</Copy>
            <CaretRight
              size={14}
              color={ink.muted}
              style={{ transform: [{ rotate: "90deg" }] }}
            />
          </View>
        </Pressable>
      </View>
      {entries
        .filter(
          (e) => e.kind === "community" || !replyIds.has(e.item.evidenceId),
        )
        .map((e) =>
          e.kind === "community" ? (
            <Card key={"community" + e.item.id}>
              <View style={s.row}>
                <UsersThree size={25} color={ink.brand} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.eyebrow}>UNMASK COMMUNITY EXPERIENCE</Text>
                  <Copy small>
                    {e.item.author_name} · {dateLabel(e.item.created_at)}
                  </Copy>
                </View>
              </View>
              <Copy>{e.item.body}</Copy>
              <View style={[s.row, { flexWrap: "wrap" }]}>
                <Pill>{topic}</Pill>
                {e.item.skin_type ? (
                  <Pill>{e.item.skin_type}</Pill>
                ) : (
                  <Pill warning>Skin type not stated</Pill>
                )}
                {e.item.duration ? <Pill>{e.item.duration}</Pill> : null}
              </View>
              <View style={s.rule} />
              <View style={[s.row, { flexWrap: "wrap" }]}>
                <Clock size={18} color={ink.muted} />
                <Copy small>
                  Use duration: {e.item.duration || "Not stated"}
                </Copy>
                <Copy small>
                  {e.item.acquisition || "Acquisition not disclosed"}
                </Copy>
              </View>
            </Card>
          ) : (
            <ExternalCard
              key={"external" + e.item.evidenceId}
              item={e.item}
              topic={topic}
              replies={external.filter((x) => x.parentId === e.item.evidenceId)}
            />
          ),
        )}
      {!entries.length ? (
        <Notice>
          No evidence explicitly linked to this topic is available in this view
          yet.
        </Notice>
      ) : null}
      <Notice>
        External comments are useful signals, not verified Unmask experiences.
        Skin type and routine context are often missing.
      </Notice>
      <LinkRow
        label={`Ask Unmask about ${topic === "All" ? "this evidence" : topic.toLowerCase()}`}
        onPress={onAsk}
      />
    </>
  );
}
export function ExternalCard({
  item,
  topic,
  replies = [],
}: {
  item: DimensionEvidenceItem;
  topic: string;
  replies?: DimensionEvidenceItem[];
}) {
  const context = item as DimensionEvidenceItem & {
    skinType?: string;
    skinTypeSource?: string;
  };
  const disclosed =
    context.skinTypeSource === "self_disclosed" ? context.skinType : undefined;
  return (
    <Card>
      <Pressable
        accessibilityRole="link"
        onPress={() => openSource(item.url)}
        style={s.row}
      >
        <YoutubeLogo size={25} color={ink.brand} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.eyebrow}>
            EXTERNAL · {item.platform.toUpperCase()}
          </Text>
          <Copy small>
            {item.videoTitle || item.sourceContext || "Product discussion"} ·{" "}
            {dateLabel(item.createdAt)}
          </Copy>
        </View>
      </Pressable>
      <View style={s.rule} />
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <ChatCircle size={25} color={ink.muted} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={s.eyebrow}>
            {item.isReply ? "REPLY" : "COMMENT THEME"}
          </Text>
          <Copy>{item.statement}</Copy>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <Pill>{topic}</Pill>
            <Pill warning={!disclosed}>
              {disclosed
                ? `${disclosed} skin · self-disclosed`
                : "Skin type not stated"}
            </Pill>
          </View>
        </View>
      </View>
      {item.parentText ? (
        <View
          style={{
            marginLeft: 14,
            paddingLeft: 23,
            borderLeftWidth: 1,
            borderLeftColor: ink.line,
            gap: 8,
          }}
        >
          <Copy small>
            Original comment · {item.parentAuthor || "Author not supplied"}
          </Copy>
          <Copy>{item.parentText}</Copy>
        </View>
      ) : null}
      {replies.length ? (
        replies.map((x) => (
          <View
            key={x.evidenceId}
            style={{
              marginLeft: 14,
              paddingLeft: 23,
              borderLeftWidth: 1,
              borderLeftColor: ink.line,
              gap: 6,
            }}
          >
            <View style={s.rule} />
            <View style={s.row}>
              <ArrowBendUpLeft size={23} color={ink.muted} />
              <Text style={s.eyebrow}>REPLIES</Text>
            </View>
            <Copy>{x.statement}</Copy>
          </View>
        ))
      ) : (
        <Pressable
          accessibilityRole="link"
          onPress={() => openSource(item.url)}
          style={{
            marginLeft: 14,
            paddingLeft: 23,
            borderLeftWidth: 1,
            borderLeftColor: ink.line,
            gap: 5,
          }}
        >
          <View style={s.row}>
            <ArrowBendUpLeft size={22} color={ink.muted} />
            <Text style={s.eyebrow}>REPLIES</Text>
          </View>
          <Copy small>
            View the original discussion for available replies and context.
          </Copy>
        </Pressable>
      )}
    </Card>
  );
}
