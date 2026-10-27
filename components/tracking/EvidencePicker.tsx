import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAppStore } from "@/lib/store";
import * as tracking from "@/lib/tracking/api";
import {
  ActionSheet,
  ActionButton,
  StatusMessage,
  MediaFrame,
  ContentSkeleton,
} from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
import { Note } from "./Fields";
function Preview({ source }: { source: tracking.EvidenceSelection }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 64 }}>
        <MediaFrame
          uri={source.image}
          label={source.title}
          ratio={1}
          corners={false}
        />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 15,
            color: colors.ink,
          }}
        >
          {source.title}
        </Text>
        <Note>
          {source.detail}
          {source.author ? ` · ${source.author}` : ""}
        </Note>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 11,
            color: colors.inkSoft,
          }}
        >
          {source.kind === "journey"
            ? "PRODUCT TIMELINE"
            : "PRODUCT EXPERIENCE"}{" "}
          · {source.visibility === "public" ? "Public" : "Private"}
        </Text>
      </View>
    </View>
  );
}
export function EvidencePicker({
  value,
  onChange,
  publicPost = true,
  productId,
  kind,
  buttonLabel,
}: {
  value: tracking.EvidenceSelection | null;
  onChange: (v: tracking.EvidenceSelection | null) => void;
  publicPost?: boolean;
  productId?: string;
  kind?: tracking.EvidenceSelection["kind"];
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false),
    [confirm, setConfirm] = useState<tracking.EvidenceSelection | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const uid = useAppStore((s) => s.profile?.id),
    r = useRouter(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["evidence-options", uid],
    queryFn: tracking.attachmentOptions,
    enabled: open && !!uid,
  });
  function choose(x: tracking.EvidenceSelection) {
    setError("");
    if (publicPost && x.visibility !== "public") {
      if (!x.owner) {
        setError(
          "Only the author can make this experience public. Choose a public experience instead.",
        );
        return;
      }
      setConfirm(x);
      return;
    }
    onChange(x);
    setOpen(false);
  }
  async function share() {
    if (!confirm || busy) return;
    setBusy(true);
    setError("");
    try {
      const shared = await tracking.shareAttachment(confirm);
      onChange(shared);
      setConfirm(null);
      setOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["evidence-options", uid] }),
        qc.invalidateQueries({ queryKey: ["tracking-journey", shared.id] }),
        qc.invalidateQueries({ queryKey: ["tracking-updates", shared.id] }),
      ]);
    } catch (e) {
      setError(
        (e as Error).message ||
          "Couldn’t share yet. Your attachment is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <ActionButton
        tone="secondary"
        label={
          buttonLabel ||
          (value
            ? "Change attached experience"
            : "Attach an experience or product timeline")
        }
        onPress={() => {
          setConfirm(null);
          setError("");
          setOpen(true);
        }}
      />
      {value ? (
        <View
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: "#F6F3EF",
            gap: 8,
          }}
        >
          <Preview source={value} />
          <ActionButton
            tone="ghost"
            label="Remove attachment"
            onPress={() => onChange(null)}
          />
        </View>
      ) : null}
      <ActionSheet
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setConfirm(null);
          }
        }}
        title={
          confirm
            ? "Share this with the conversation?"
            : "Bring your experience"
        }
      >
        {confirm ? (
          <>
            <Preview source={confirm} />
            <Note>
              {confirm.kind === "journey"
                ? "This timeline is private. Confirming makes the journal, its existing notes, routine and progress photos public so people can open it from your answer. Your ownership proof photo stays private."
                : "This experience is private. Confirming makes the experience and its attached public content visible to everyone."}
            </Note>
            <Note>
              You can change its privacy later. People may already have seen
              what you shared.
            </Note>
            <ActionButton
              label="Make public & attach"
              pending={busy}
              pendingLabel="Sharing…"
              onPress={() => void share()}
            />
            <ActionButton
              tone="ghost"
              label="Keep private"
              disabled={busy}
              onPress={() => {
                setConfirm(null);
                setError("");
              }}
            />
          </>
        ) : (
          <>
            <Note>
              Choose your product timeline, your experience, or an experience
              you saved. The original author keeps the credit.
            </Note>
            {!uid ? (
              <ActionButton
                label="Sign in to see your experiences"
                onPress={() => {
                  setOpen(false);
                  r.push("/(auth)/sign-in");
                }}
              />
            ) : null}
            {q.isLoading ? <ContentSkeleton /> : null}
            {q.isError ? (
              <ActionButton
                label="Retry experiences"
                onPress={() => void q.refetch()}
              />
            ) : null}
            {(q.data ?? [])
              .filter(
                (x) =>
                  (!productId || x.productId === productId) &&
                  (!kind || x.kind === kind),
              )
              .map((x) => (
                <Pressable
                  key={`${x.kind}-${x.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Attach ${x.title}${x.visibility !== "public" ? ", private" : ""}`}
                  onPress={() => choose(x)}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: pressed ? "#EEE8E2" : "#fff",
                  })}
                >
                  <Preview source={x} />
                </Pressable>
              ))}
            {uid && q.isSuccess && !q.data.length ? (
              <StatusMessage
                title="No experiences yet"
                detail="Track a product, share an experience, or save a public experience to attach it here."
              />
            ) : null}
            <ActionButton
              tone="ghost"
              label="Start a product timeline"
              onPress={() => {
                setOpen(false);
                r.push("/products/add");
              }}
            />
          </>
        )}
        {error ? (
          <StatusMessage kind="error" title="Not attached yet" detail={error} />
        ) : null}
      </ActionSheet>
    </View>
  );
}
