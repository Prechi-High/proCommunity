import { useEffect, useRef, useState } from "react";
import { Linking, Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  TeamGate,
  TeamPage,
  useTeamAction,
  ActionResult,
} from "@/components/team/Page";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { videoUrl } from "@/lib/creator/api";
import * as api from "@/lib/team/api";
export default function Review() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <TeamGate>
      <Content initial={id} />
    </TeamGate>
  );
}
function Content({ initial }: { initial?: string }) {
  const [id, setId] = useState(initial || "");
  const q = useQuery({ queryKey: ["team", "reviews"], queryFn: api.reviews });
  const creators = useQuery({
    queryKey: ["team", "creators"],
    queryFn: api.creators,
  });
  const s = q.data?.find((s) => s.id === id);
  return (
    <TeamPage title="Review the investigation" tab="Review">
      <Copy>Check accuracy, transparency and balance before publication.</Copy>
      <Busy
        loading={q.isLoading || creators.isLoading}
        error={q.error || creators.error}
        retry={() => {
          void q.refetch();
          void creators.refetch();
        }}
      />
      {!s ? (
        q.data?.map((s) => (
          <Card key={s.id}>
            <Heading>{s.title}</Heading>
            <Copy>
              {creators.data?.find((c) => c.user_id === s.creator_id)
                ?.display_name || "Creator"}
            </Copy>
            <Pill>{s.status}</Pill>
            <Button label="Review submission" onPress={() => setId(s.id)} />
          </Card>
        ))
      ) : (
        <>
          <Button
            quiet
            label="Choose another submission"
            onPress={() => setId("")}
          />
          <ReviewForm key={s.id} submission={s} />
        </>
      )}
      {q.data?.length === 0 ? <Copy>No creator submissions yet.</Copy> : null}
    </TeamPage>
  );
}
function ReviewForm({
  submission: s,
}: {
  submission: Awaited<ReturnType<typeof api.reviews>>[number];
}) {
  const action = useTeamAction();
  const [checks, setChecks] = useState<Record<string, boolean>>({
    sources: false,
    permissions: false,
    uncertainty: false,
    commercial: false,
  });
  const [feedback, setFeedback] = useState(s.feedback || "");
  const [when, setWhen] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [data, setData] = useState<api.PublicationData>({
    video_url: "",
    thumbnail_url: "",
    findings: "",
    company_response: "",
    uncertainty: "",
    sources: s.sources,
  });
  const loaded = useRef(false);
  const plan = useQuery({
    queryKey: ["team", "plan", s.id],
    queryFn: () => api.plan(s.id),
  });
  const history = useQuery({
    queryKey: ["team", "review-history", s.id],
    queryFn: () =>
      api.read<
        { id: string; decision: string; feedback: string; created_at: string }[]
      >(
        importDb()
          .from("unmask_editorial_decisions")
          .select("*")
          .eq("submission_id", s.id)
          .order("created_at", { ascending: false }),
      ),
  });
  useEffect(() => {
    if (plan.isSuccess && !loaded.current) {
      if (plan.data) {
        setData(plan.data.payload);
        setWhen(plan.data.scheduled_for || "");
      }
      loaded.current = true;
    }
  }, [plan.data, plan.isSuccess]);
  const save = (publish: boolean) =>
    action.mutate(() => api.publish(s.id, data, api.dateTime(when), publish));
  return (
    <>
      <Card>
        <Heading>{s.title}</Heading>
        <Pill>{s.status}</Pill>
        <Copy>{s.summary}</Copy>
        <Copy small>
          Submitted{" "}
          {new Date(s.created_at).toLocaleString("en-NG", {
            timeZone: "Africa/Lagos",
          })}
        </Copy>
        <Button
          label="Preview private video"
          onPress={() => {
            setVideoError("");
            void videoUrl(s.video_path)
              .then((x) => Linking.openURL(x.signedUrl))
              .catch(() => setVideoError("Could not open the private video."));
          }}
        />
        {videoError ? <Notice>{videoError}</Notice> : null}
        <Heading>Sources & disclosure</Heading>
        <Copy>{s.sources}</Copy>
        <Pill>{s.disclosure}</Pill>
        {s.response ? <Copy>Creator response: {s.response}</Copy> : null}
        <Copy>{s.narrative}</Copy>
      </Card>
      <Card>
        <Heading>Review checklist</Heading>
        {[
          ["sources", "Source attribution"],
          ["permissions", "Contributor permissions"],
          ["uncertainty", "Uncertainty explained"],
          ["commercial", "Commercial disclosure"],
        ].map(([key, label]) => (
          <View
            key={key}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Copy>{label}</Copy>
            <Switch
              value={checks[key]}
              accessibilityLabel={label}
              onValueChange={(v) => setChecks({ ...checks, [key]: v })}
            />
          </View>
        ))}
      </Card>
      <Field
        label="Editorial feedback (10–500 characters)"
        multiline
        value={feedback}
        onChange={setFeedback}
      />
      <Button
        quiet
        disabled={
          action.isPending ||
          feedback.trim().length < 10 ||
          feedback.length > 500
        }
        label="Request changes"
        onPress={() =>
          action.mutate(() =>
            api.decide(s.id, "changes_requested", feedback, checks),
          )
        }
      />
      <Button
        disabled={
          action.isPending ||
          feedback.trim().length < 10 ||
          feedback.length > 500 ||
          !Object.values(checks).every(Boolean)
        }
        label="Approve for publication"
        onPress={() =>
          action.mutate(() => api.decide(s.id, "approved", feedback, checks))
        }
      />
      {s.status === "approved" ? (
        <Card>
          <Heading>Publication plan</Heading>
          <Busy loading={plan.isLoading} error={plan.error} />
          {(Object.keys(data) as (keyof api.PublicationData)[]).map((key) => (
            <Field
              key={key}
              label={key.replaceAll("_", " ")}
              multiline={!key.includes("url")}
              value={data[key]}
              onChange={(v) => setData({ ...data, [key]: v })}
            />
          ))}
          <Copy small>
            Use a permanent public video URL, not an expiring private preview
            link. Findings, sources and uncertainty are required.
          </Copy>
          <Field
            label="Scheduled time (YYYY-MM-DDTHH:mm, Lagos; optional)"
            value={when}
            onChange={setWhen}
          />
          <Button
            quiet
            disabled={action.isPending || plan.isLoading}
            label="Save publication plan"
            onPress={() => save(false)}
          />
          <Copy small>
            The schedule is recorded for the team. Publication is manual until a
            publishing scheduler is connected.
          </Copy>
          <Button
            disabled={action.isPending || plan.isLoading}
            label="Review & publish now"
            onPress={() => setConfirm(true)}
          />
          {confirm ? (
            <>
              <Notice>
                This will publish these findings, sources, company response and
                video URL to the community.
              </Notice>
              <Button
                disabled={action.isPending}
                label="Confirm publication"
                onPress={() => save(true)}
              />
              <Button quiet label="Cancel" onPress={() => setConfirm(false)} />
            </>
          ) : null}
          {plan.data?.published_at ? (
            <Pill>
              Published{" "}
              {new Date(plan.data.published_at).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
              })}
            </Pill>
          ) : null}
        </Card>
      ) : null}
      <ActionResult action={action} />
      <Heading>Review history</Heading>
      <Busy loading={history.isLoading} error={history.error} />
      {history.data?.map((h) => (
        <Card key={h.id}>
          <Pill>{h.decision}</Pill>
          <Copy>{h.feedback}</Copy>
          <Copy small>
            {new Date(h.created_at).toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
          </Copy>
        </Card>
      ))}
    </>
  );
}
import { db as importDb } from "@/lib/clarity/api";
