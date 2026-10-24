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
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import { useAppStore } from "@/lib/store";
type Entry = {
  id: string;
  investigation_id: string;
  kind: string;
  amount: number;
  public_ack: boolean;
  created_at: string;
  unmask_investigations: { title: string } | null;
};
export default function History() {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const [filter, setFilter] = useState("All");
  const q = useQuery({
    queryKey: ["spark-history", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await db()
        .from("unmask_spark_contributions")
        .select(
          "id,investigation_id,kind,amount,public_ack,created_at,unmask_investigations(title)",
        )
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Entry[];
    },
  });
  const entries = q.data?.filter(
    (e) =>
      filter === "All" ||
      e.kind === (filter === "Sparks" ? "sparks" : "thunder"),
  );
  return (
    <UtilityPage
      title="Every Spark has a story."
      sub="Your recorded support, newest first. Showing up to 100 contributions."
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
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          {entries?.map((e) => (
            <Card key={e.id}>
              <Pill>
                {e.kind === "sparks" ? "✦ Sparks" : "⚡ Thunder Sparks"}
              </Pill>
              <Heading>{e.amount} added</Heading>
              <Copy>{e.unmask_investigations?.title ?? "Investigation"}</Copy>
              <Copy small>
                {new Date(e.created_at).toLocaleString()} ·{" "}
                {e.public_ack
                  ? "Public acknowledgment"
                  : "Anonymous acknowledgment"}
              </Copy>
              <Copy small>Receipt: {e.id}</Copy>
              <Button
                quiet
                label="Open investigation"
                onPress={() =>
                  r.push(`/investigation/${e.investigation_id}` as Href)
                }
              />
            </Card>
          ))}
          {entries?.length === 0 ? (
            <Card>
              <Heading>No contributions here yet.</Heading>
              <Copy>
                When you support an investigation, your receipt will appear
                here.
              </Copy>
              <Button
                label="Explore investigations"
                onPress={() => r.push("/investigation")}
              />
            </Card>
          ) : null}
        </>
      )}
    </UtilityPage>
  );
}
