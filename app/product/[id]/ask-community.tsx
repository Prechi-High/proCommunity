import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  Drop,
  LinkSimple,
  PencilSimple,
  Plus,
  UsersThree,
} from "@/components/icons";
import { useMemberGate } from "@/components/community";
import {
  getKnownProduct,
  investigateProduct,
  profileToProduct,
} from "@/lib/products";
import { postThread } from "@/lib/community";
import { useAppStore } from "@/lib/store";
import {
  BottomNav,
  Button,
  Card,
  Chips,
  Copy,
  Field,
  Header,
  Heading,
  Identity,
  Notice,
  Pill,
  ink,
  s,
} from "@/components/unmask/reference/ui";
export default function AskCommunityScreen() {
  const r = useRouter();
  const qc = useQueryClient();
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const uid = useAppStore((x) => x.profile?.id);
  const name = useAppStore((x) => x.profile?.displayName) || "You";
  const key = `unmask:question-draft:${uid || "guest"}:${id}`;
  const [title, setTitle] = useState(q || "");
  const [details, setDetails] = useState("");
  const [skin, setSkin] = useState("Not shared");
  const [routine, setRoutine] = useState("");
  const [skinOpen, setSkinOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [status, setStatus] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const { requireMember, gate } = useMemberGate();
  const intel = useQuery({
    queryKey: ["intel", id],
    queryFn: () => investigateProduct({ id }),
    enabled: !!id,
  });
  const profile = intel.data;
  const known = getKnownProduct(id);
  const product = profile ? profileToProduct(profile, known) : known;
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw);
        setTitle(q || saved.title || "");
        setDetails(saved.details || "");
        setSkin(saved.skin || "Not shared");
        setRoutine(saved.routine || "");
      })
      .catch(() => setStatus("Your saved draft could not be loaded."))
      .finally(() => {
        if (!cancelled) setDraftLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key, q]);
  const draft = async () => {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ title, details, skin, routine }),
      );
      setStatus("Draft saved privately on this device.");
    } catch {
      setStatus("Draft could not be saved. Please try again.");
    }
  };
  const post = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("Product information is not ready.");
      return postThread({
        product,
        kind: "question",
        title: title.trim(),
        body: [
          details.trim(),
          skin !== "Not shared" ? `Skin context (self-disclosed): ${skin}` : "",
          routine.trim() ? `Routine context: ${routine.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
    },
    onSuccess: async (t) => {
      await AsyncStorage.removeItem(key);
      void qc.invalidateQueries({ queryKey: ["threads", id] });
      void qc.invalidateQueries({ queryKey: ["pulse"] });
      r.replace(`/thread/${t.id}?unmask=1` as Href);
    },
  });
  const preview = (
    <Card>
      <View style={s.row}>
        <View
          style={{
            height: 33,
            width: 33,
            borderRadius: 99,
            backgroundColor: ink.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Copy>{name[0].toUpperCase()}</Copy>
        </View>
        <Copy>{name}</Copy>
        <Pill>Question</Pill>
        <Copy small>Just now (preview)</Copy>
      </View>
      {product ? <Identity product={product} profile={profile} /> : null}
      <Copy>{title || "Your question will appear here."}</Copy>
      {details ? <Copy muted>{details}</Copy> : null}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {skin !== "Not shared" ? <Pill>{skin} skin</Pill> : null}
        <Pill>{routine || "Routine not added"}</Pill>
      </View>
      <View style={s.row}>
        <UsersThree size={20} color={ink.muted} />
        <Copy small>Community-visible after you post</Copy>
      </View>
    </Card>
  );
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <Header onBack={() => (review ? setReview(false) : r.back())} />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pill>ASK THE COMMUNITY · {review ? "2" : "1"} OF 2</Pill>
        <Heading hero>
          {review ? "Review before sharing" : "Ask people who’ve used it"}
        </Heading>
        <Copy muted>
          {review
            ? "Check what the community will see. You can still edit anything."
            : "Your question will be shared only after you review and post it."}
        </Copy>
        {review ? (
          <>
            <Heading>Preview</Heading>
            {preview}
            <Card>
              <View style={s.row}>
                <UsersThree size={28} color={ink.brand} />
                <Heading>Community-visible</Heading>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setReview(false);
                    setStatus(
                      "To keep this question private, choose Save draft.",
                    );
                  }}
                >
                  <Copy small>Change</Copy>
                </Pressable>
              </View>
              <Copy muted>
                Anyone in the Unmask community can read and reply. Your selected
                context will appear with your question.
              </Copy>
            </Card>
            <Card>
              <Heading>Your skin context is optional.</Heading>
              <Copy muted>
                Remove it if you’d rather ask without sharing it.
              </Copy>
              <Button
                quiet
                label="Remove context"
                onPress={() => {
                  setSkin("Not shared");
                  setRoutine("");
                }}
              />
            </Card>
            <Heading>What happens next</Heading>
            {[
              [
                "Post question",
                "Your question will be shared with the Unmask community.",
              ],
              [
                "Community members can reply",
                "People can share relevant experiences.",
              ],
              [
                "Check for replies",
                "Return to this thread to read new responses.",
              ],
            ].map(([title, body], i) => (
              <View key={title} style={s.row}>
                <Pill>{i + 1}</Pill>
                <View style={{ flex: 1, gap: 4 }}>
                  <Copy>{title}</Copy>
                  <Copy small>{body}</Copy>
                </View>
              </View>
            ))}
            <View style={s.row}>
              <Button
                quiet
                label="Back to edit"
                onPress={() => setReview(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={post.isPending ? "Posting…" : "Post question"}
                disabled={post.isPending || !title.trim() || !product}
                onPress={() => requireMember(() => post.mutate())}
                style={{ flex: 1 }}
              />
            </View>
            <Copy small>Nothing has been shared yet.</Copy>
          </>
        ) : (
          <>
            {product ? (
              <Card>
                <Identity product={product} profile={profile} attached />
              </Card>
            ) : null}
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Heading>Your question</Heading>
              <Copy small>{title.length}/300</Copy>
            </View>
            <Field
              value={title}
              onChangeText={setTitle}
              multiline
              maxLength={300}
              placeholder="Your question"
            />
            <Heading>Add context (optional)</Heading>
            <Copy muted>
              Context helps people give more relevant and informed answers.
            </Copy>
            <View style={s.row}>
              <Pressable
                onPress={() => setSkinOpen(!skinOpen)}
                style={[s.card, s.row, { flex: 1 }]}
              >
                <Drop size={25} color={ink.brand} />
                <View style={{ flex: 1 }}>
                  <Copy>Skin type</Copy>
                  <Copy small>{skin === "Not shared" ? "Add" : skin}</Copy>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setRoutineOpen(!routineOpen)}
                style={[s.card, s.row, { flex: 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Copy>Routine</Copy>
                  <Copy small>{routine ? "Added" : "Add"}</Copy>
                </View>
                <Plus size={20} color={ink.muted} />
              </Pressable>
            </View>
            {skinOpen ? (
              <Chips
                options={[
                  "Not shared",
                  "Dry",
                  "Oily",
                  "Combination",
                  "Normal",
                  "Sensitive",
                ]}
                value={skin}
                onChange={setSkin}
              />
            ) : null}
            {routineOpen ? (
              <Field
                value={routine}
                onChangeText={setRoutine}
                placeholder="Your routine context (optional)"
                maxLength={300}
              />
            ) : null}
            <Copy small>Only share details you’re comfortable sharing.</Copy>
            <Copy muted>What would make an answer useful to you?</Copy>
            <Field
              value={details}
              onChangeText={setDetails}
              placeholder="e.g. whether it leaves skin feeling tight"
              multiline
              maxLength={1000}
            />
            <Heading>Preview</Heading>
            {preview}
            <Notice>
              Community members may have relevant experience when the available
              evidence does not fully answer your question.
            </Notice>
            <View style={s.row}>
              <Button
                quiet
                label="Save draft"
                onPress={() => void draft()}
                disabled={!draftLoaded}
                style={{ flex: 1 }}
              />
              <Button
                label="Continue to review"
                disabled={!title.trim() || !product}
                onPress={() => {
                  setStatus("");
                  setReview(true);
                }}
                style={{ flex: 1.3 }}
              />
            </View>
          </>
        )}
        {status ? <Notice>{status}</Notice> : null}
        {post.error ? (
          <Notice>
            {post.error instanceof Error
              ? post.error.message
              : "Unable to post. Please retry."}
          </Notice>
        ) : null}
      </ScrollView>
      <BottomNav community />
      {gate}
    </SafeAreaView>
  );
}
