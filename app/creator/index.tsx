import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { CreatorGate } from "@/components/creator/Gate";
import { ProfileIdentity } from "@/components/profiles/Identity";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/creator/api";

export default function CreatorHome() {
  return (
    <CreatorGate>
      <Workspace />
    </CreatorGate>
  );
}
function Workspace() {
  const uid = useAppStore((s) => s.profile!.id);
  const r = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("Assignments");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creator = useQuery({
    queryKey: ["creator-membership", uid],
    queryFn: api.membership,
  });
  const assignments = useQuery({
    queryKey: ["creator-assignments", uid],
    queryFn: api.assignments,
  });
  const drafts = useQuery({
    queryKey: ["creator-drafts", uid],
    queryFn: api.drafts,
  });
  const reviews = useQuery({
    queryKey: ["creator-reviews", uid],
    queryFn: api.reviews,
  });
  const videos = useQuery({
    queryKey: ["creator-published-week", uid],
    queryFn: async () => {
      const { db } = await import("@/lib/clarity/api");
      const now = new Date(Date.now() + 3600000);
      const day = (now.getUTCDay() + 6) % 7;
      now.setUTCDate(now.getUTCDate() - day);
      now.setUTCHours(0, 0, 0, 0);
      const { count, error } = await db()
        .from("unmask_creator_publications")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", uid)
        .eq("published", true)
        .gte("published_at", new Date(now.getTime() - 3600000).toISOString());
      if (error) throw error;
      return count || 0;
    },
  });
  const rows = (assignments.data ?? []).filter((a) => {
    const review = reviews.data?.find((s) => s.investigation_id === a.id);
    return tab === "Published"
      ? a.status === "published"
      : tab === "In review"
        ? a.status !== "published" && review?.status === "in_review"
        : a.status !== "published" && review?.status !== "in_review";
  });
  return (
    <UtilityPage
      title="Your next question starts here."
      sub="PRIVATE CREATOR WORKSPACE"
    >
      <ProfileIdentity
        name={creator.data?.display_name || "Unmask Creator"}
        avatar={creator.data?.avatar_url}
      />
      <Button
        quiet
        label="View public profile →"
        onPress={() => r.push(`/creators?id=${uid}` as Href)}
      />
      <Card>
        <Copy>This week · Monday–Sunday (Lagos)</Copy>
        <Busy
          loading={videos.isLoading}
          error={videos.error}
          retry={() => void videos.refetch()}
        />
        {videos.isSuccess ? (
          <Heading>{videos.data} of 2 videos published</Heading>
        ) : null}
        <Copy small>
          Two videos is the current planning target. Publication count uses
          recorded publication dates.
        </Copy>
      </Card>
      <Chips
        options={["Assignments", "In review", "Published"]}
        value={tab}
        onChange={setTab}
      />
      <Busy
        loading={assignments.isLoading || drafts.isLoading || reviews.isLoading}
        error={assignments.error || drafts.error || reviews.error}
        retry={() => {
          void assignments.refetch();
          void drafts.refetch();
          void reviews.refetch();
        }}
      />
      {error ? <Notice>{error}</Notice> : null}
      {rows.map((a) => {
        const d = drafts.data?.find((d) => d.investigation_id === a.id);
        const review = reviews.data?.find((s) => s.investigation_id === a.id);
        return (
          <Card key={a.id}>
            <Photo uri={a.unmask_catalog?.image_url} size={100} />
            <Pill>
              {a.status === "published"
                ? "Published"
                : review
                  ? review.status.replaceAll("_", " ")
                  : d?.accepted
                    ? "In progress"
                    : "Awaiting your confirmation"}
            </Pill>
            <Heading>{a.title}</Heading>
            <Copy>{a.unmask_catalog?.name}</Copy>
            <Copy small>Assignment from Unmask Editorial.</Copy>
            <Button
              quiet
              label="View brief"
              onPress={() => r.push(`/creator/assignment?id=${a.id}` as Href)}
            />
            {!d?.accepted && a.status !== "published" ? (
              <Button
                disabled={busy}
                label="Confirm availability"
                onPress={() => {
                  setBusy(true);
                  setError("");
                  void api
                    .saveDraft(a.id, { accepted: true })
                    .then(() =>
                      qc.invalidateQueries({
                        queryKey: ["creator-drafts", uid],
                      }),
                    )
                    .catch(() =>
                      setError("Could not confirm availability. Retry."),
                    )
                    .finally(() => setBusy(false));
                }}
              />
            ) : a.status !== "published" ? (
              <Button
                label={
                  review ? "View feedback / submission" : "Start submission"
                }
                onPress={() => r.push(`/creator/submit?id=${a.id}` as Href)}
              />
            ) : (
              <Button
                label="View published investigation"
                onPress={() => r.push(`/investigation/${a.id}` as Href)}
              />
            )}
          </Card>
        );
      })}
      {assignments.isSuccess && rows.length === 0 ? (
        <Copy>No {tab.toLowerCase()} to show yet.</Copy>
      ) : null}
      <Card>
        <Heading>View earnings and weekly payouts →</Heading>
        <Copy>Your completed work and recorded payout history.</Copy>
        <Button
          label="Open earnings"
          onPress={() => r.push("/creator/earnings")}
        />
      </Card>
    </UtilityPage>
  );
}
