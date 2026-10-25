import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import { history } from "@/lib/utilities/api";
import { useAppStore } from "@/lib/store";
export default function History() {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const [filter, setFilter] = useState("All");
  const [dates, setDates] = useState("All dates");
  const [status, setStatus] = useState("All statuses");
  const q = useQuery({
    queryKey: ["spark-history", uid],
    queryFn: history,
    enabled: !!uid,
  });
  const days =
    dates === "Last 7 days" ? 7 : dates === "Last 30 days" ? 30 : null;
  const entries = q.data?.filter(
    (e) =>
      (filter === "All" ||
        e.kind === (filter === "Sparks" ? "sparks" : "thunder")) &&
      (!days || Date.parse(e.created_at) >= Date.now() - days * 86400000) &&
      (status === "All statuses" || e.unmask_investigations?.status === status),
  );
  return (
    <UtilityPage
      title="What you helped move forward."
      sub="A history of the questions you supported. Your contributions help fund investigations and independent video reviews."
    >
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Chips
            options={["All", "Sparks", "Thunder Sparks"]}
            value={filter}
            onChange={setFilter}
          />
          <Chips
            options={["All dates", "Last 7 days", "Last 30 days"]}
            value={dates}
            onChange={setDates}
          />
          <Chips
            options={[
              "All statuses",
              "requested",
              "selected",
              "investigating",
              "published",
            ]}
            value={status}
            onChange={setStatus}
          />
          <Copy small>Showing up to 100 most recent contributions.</Copy>
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          {entries?.map((e) => (
            <Card key={e.id}>
              {e.unmask_investigations?.unmask_catalog?.image_url ? (
                <Photo
                  uri={e.unmask_investigations.unmask_catalog.image_url}
                  size={90}
                />
              ) : null}
              <Heading>
                {e.unmask_investigations?.title ?? "Investigation"}
              </Heading>
              <Copy>
                {e.kind === "sparks" ? "✦" : "⚡"} {e.amount}{" "}
                {e.kind === "sparks" ? "Sparks" : "Thunder Sparks"} · ₦
                {(
                  e.amount * (e.kind === "sparks" ? 10 : 1000)
                ).toLocaleString()}{" "}
                equivalent
              </Copy>
              <Copy>
                {e.public_ack ? "Public acknowledgment" : "Anonymous"}
              </Copy>
              {e.unmask_investigations ? (
                <Pill>{e.unmask_investigations.status}</Pill>
              ) : null}
              <Copy small>
                {new Date(e.created_at).toLocaleString()} · Receipt: {e.id}
              </Copy>
              <Button
                quiet
                label="View investigation →"
                onPress={() =>
                  r.push(`/investigation/${e.investigation_id}` as Href)
                }
              />
            </Card>
          ))}
          {entries?.length === 0 ? (
            <Copy>No contributions match these filters.</Copy>
          ) : null}
        </>
      )}
    </UtilityPage>
  );
}
