import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  ChatCircle,
  PaperPlaneRight,
  ShareNetwork,
  ThumbsUp,
  UsersThree,
} from "@/components/icons";
import {
  fetchThread,
  followThread,
  markHelpful,
  postReply,
  timeAgo,
} from "@/lib/community";
import { useMemberGate } from "@/components/community";
import { useAppStore } from "@/lib/store";
import {
  BottomNav,
  Button,
  Busy,
  Card,
  Copy,
  Header,
  Heading,
  Identity,
  Notice,
  Pill,
  ink,
  s,
} from "./ui";
export function ReferenceQuestionThread({ id }: { id: string }) {
  const r = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((x) => x.profile);
  const { requireMember, gate } = useMemberGate();
  const [body, setBody] = useState("");
  const [helped, setHelped] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const input = useRef<TextInput>(null);
  const query = useQuery({
    queryKey: ["thread", id],
    queryFn: () => fetchThread(id),
    enabled: !!id,
    refetchInterval: 30000,
  });
  const t = query.data;
  const replies = t?.community_replies || [];
  const following = useMutation({
    mutationFn: () => followThread(id, !t?.following),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["thread", id] }),
  });
  const reply = useMutation({
    mutationFn: () => postReply(id, body.trim()),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["thread", id] });
      if (t) void qc.invalidateQueries({ queryKey: ["threads", t.product_id] });
    },
  });
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <Header
        onBack={() => (r.canGoBack() ? r.back() : r.replace("/unmask"))}
        right={
          <Pressable
            accessibilityLabel="Share question"
            onPress={() =>
              t && void Share.share({ message: `${t.title} — Unmask` })
            }
          >
            <ShareNetwork size={25} color={ink.text} />
          </Pressable>
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Pill>COMMUNITY QUESTION</Pill>
          <Button
            quiet
            label={t?.following ? "Following" : "Follow"}
            disabled={following.isPending || !t}
            onPress={() => requireMember(() => following.mutate())}
            icon={<Bell size={17} color={ink.brand} />}
          />
        </View>
        <Busy
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {t ? (
          <>
            <Heading hero>{t.title}</Heading>
            <Card>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Copy>
                  {t.author_id === profile?.id ? "You asked" : t.author_name} ·{" "}
                  {timeAgo(t.created_at)}
                </Copy>
                <Pill>Open</Pill>
              </View>
              <Pressable
                onPress={() =>
                  r.push({
                    pathname: "/product/[id]",
                    params: { id: t.product_id, q: t.product_name },
                  } as Href)
                }
              >
                <Identity
                  product={{
                    id: t.product_id,
                    name: t.product_name,
                    brand: t.brand || "",
                    category: t.category || "Product",
                    heroImageUrl: t.product_image,
                  }}
                />
              </Pressable>
              <Copy>{t.title}</Copy>
              {t.body ? <Copy muted>{t.body}</Copy> : null}
              <View style={s.row}>
                <UsersThree size={23} color={ink.muted} />
                <Copy small>Community question</Copy>
              </View>
            </Card>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Heading>Responses</Heading>
              <Copy small>
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </Copy>
            </View>
            {replies.map((x) => (
              <Card key={x.id}>
                <View style={s.row}>
                  <View
                    style={{
                      width: 33,
                      height: 33,
                      borderRadius: 99,
                      backgroundColor: ink.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Copy>{x.author_name[0]}</Copy>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Copy>{x.author_name}</Copy>
                    <Copy small>{timeAgo(x.created_at)}</Copy>
                  </View>
                  <Pill>
                    {x.is_owner ? "Verified owner" : "Community member"}
                  </Pill>
                </View>
                <Copy>{x.body}</Copy>
                <View style={s.row}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={helped.includes(x.id)}
                    onPress={() =>
                      requireMember(() => {
                        setHelped((v) => [...v, x.id]);
                        void markHelpful(x.id).catch(() =>
                          setActionError("Unable to save helpful feedback."),
                        );
                      })
                    }
                    style={s.row}
                  >
                    <ThumbsUp size={20} color={ink.muted} />
                    <Copy small>
                      {helped.includes(x.id)
                        ? "Marked helpful"
                        : `Helpful (${x.helpful})`}
                    </Copy>
                  </Pressable>
                  <Pressable
                    style={s.row}
                    onPress={() => {
                      setBody(`@${x.author_name} `);
                      input.current?.focus();
                    }}
                  >
                    <ChatCircle size={20} color={ink.muted} />
                    <Copy small>Reply</Copy>
                  </Pressable>
                </View>
              </Card>
            ))}
            {!replies.length ? (
              <Notice>
                No replies yet. Your question is open for relevant experiences.
              </Notice>
            ) : null}
            <Card>
              <Heading>Share your experience</Heading>
              <View style={s.row}>
                <TextInput
                  ref={input}
                  accessibilityLabel="Add a reply"
                  placeholder="Add a reply…"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  style={[s.input, { flex: 1 }]}
                />
                <Button
                  label="Send"
                  disabled={body.trim().length < 2 || reply.isPending}
                  onPress={() => requireMember(() => reply.mutate())}
                />
              </View>
              <Copy small>Only share what you’re comfortable sharing.</Copy>
            </Card>
            {reply.error ? (
              <Notice>Reply could not be posted. Please try again.</Notice>
            ) : null}
            {following.error ? (
              <Notice>
                Unable to update question following. Please retry.
              </Notice>
            ) : null}
            {actionError ? <Notice>{actionError}</Notice> : null}
            <Notice>
              Experiences vary. Skin type, routine and length of use can change
              how a product feels.
            </Notice>
          </>
        ) : null}
      </ScrollView>
      <BottomNav community />
      {gate}
    </SafeAreaView>
  );
}
