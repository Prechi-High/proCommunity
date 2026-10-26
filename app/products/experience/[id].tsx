import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppShell,
  ActionButton,
  ContentSkeleton,
  StatusMessage,
} from "@/components/unmask-ui";
import { JournalProduct, JournalCard } from "@/components/tracking/JournalUI";
import { Label, Note } from "@/components/tracking/Fields";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import { useState } from "react";
export default function SavedProductExperience() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["shelf-experience", id, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await db()
        .from("clarity_experiences")
        .select("*")
        .eq("id", id)
        .eq("user_id", uid!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const product = useQuery({
    queryKey: ["catalog", q.data?.product_id],
    enabled: !!q.data?.product_id,
    queryFn: () => living.catalog(q.data!.product_id),
  });
  const e = q.data,
    p = product.data?.[0];
  async function start() {
    if (!e) return;
    try {
      await AsyncStorage.setItem(
        `unmask:tracking:${uid}:${e.product_id}`,
        JSON.stringify({
          step: 1,
          product: e.product_id,
          status: e.usage_status === "Still using" ? "active" : "stopped",
          duration: e.duration || "",
          frequency: e.frequency || "",
          skin: e.skin_type || "",
          body: e.body,
          visibility: e.visibility,
        }),
      );
      r.push(
        `/products/add?product=${encodeURIComponent(e.product_id)}` as Href,
      );
    } catch {
      setError("Your experience is safe. Try opening the journal again.");
    }
  }
  return (
    <AppShell
      back
      navigation
      title="My product experience"
      subtitle="Your own product record, separate from its community post."
    >
      {!uid ? (
        <ActionButton
          label="Sign in to see my product record"
          onPress={() => r.push("/(auth)/sign-in")}
        />
      ) : null}
      {q.isLoading && uid ? <ContentSkeleton /> : null}
      {q.isError ? (
        <StatusMessage
          kind="error"
          title="This product record is private or unavailable."
        />
      ) : null}
      {e ? (
        <>
          <JournalProduct
            name={p?.name || "Your product"}
            brand={p?.brand}
            image={p?.image_url}
          />
          <JournalCard title="What you’ve recorded">
            <Label>
              {e.duration || "Duration not stated"} ·{" "}
              {e.usage_status || "Experience"}
            </Label>
            <Note>
              {e.frequency || "Routine not stated"}
              {e.skin_type ? ` · ${e.skin_type} skin` : ""}
            </Note>
            <Note>{e.body}</Note>
            <Note>
              {e.visibility === "public"
                ? "This experience is shared with the community."
                : "This experience is private."}
            </Note>
          </JournalCard>
          <JournalCard
            title="Give this experience a timeline."
            detail="Keep the original note. Add new chapters, a routine and photos to compare your experience over time."
          >
            <ActionButton
              label="Continue this experience in a journal"
              onPress={() => void start()}
            />
            <Note>
              You’ll confirm your usage context, privacy and product ownership
              photo before saving.
            </Note>
          </JournalCard>
        </>
      ) : null}
      {error ? <StatusMessage kind="error" title={error} /> : null}
    </AppShell>
  );
}
