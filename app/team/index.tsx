import { setSparkGoal } from '@/lib/investigations/api';
import { Field } from '@/components/living/ui';
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  TeamGate,
  TeamPage,
  useTeamAction,
  ActionResult,
} from "@/components/team/Page";
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
import * as api from "@/lib/team/api";
export default function Queue() {
  return (
    <TeamGate>
      <Content />
    </TeamGate>
  );
}
function Content() {
  const r = useRouter();
  const [goals, setGoals] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("requested");
  const [sort, setSort] = useState("Most sparked");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const action = useTeamAction();
  const q = useInfiniteQuery({
    queryKey: ["team", "queue", status, sort],
    queryFn: ({ pageParam }) => api.queue(status, sort, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const creators = useQuery({
    queryKey: ["team", "creators"],
    queryFn: api.creators,
  });
  return (
    <TeamPage title="Investigation queue" tab="Queue">
      <Copy>
        Community questions selected for deeper investigation. Financial support
        is not evidence.
      </Copy>
      <Chips
        options={["requested", "selected", "investigating", "published"]}
        value={status}
        onChange={setStatus}
      />
      <Chips
        options={["Most sparked", "Recent"]}
        value={sort}
        onChange={setSort}
      />
      <Busy
        loading={q.isLoading || creators.isLoading}
        error={q.error || creators.error}
        retry={() => {
          void q.refetch();
          void creators.refetch();
        }}
      />
      {q.data?.pages.flat().map((i) => (
        <Card key={i.id}>
          {i.status === 'requested' ? <><Field label="Investigation target (Spark equivalents)" value={goals[i.id] ?? String(i.spark_goal ?? 500)} onChange={v => setGoals({ ...goals, [i.id]: v })}/><Button quiet label="Save support target" disabled={action.isPending || !/^\d+$/.test(goals[i.id] ?? String(i.spark_goal ?? 500))} onPress={() => action.mutate(() => setSparkGoal(i.id, Number(goals[i.id] ?? i.spark_goal ?? 500)))}/></> : null}
          <Heading>{i.title}</Heading>
          <Photo uri={i.product_image} size={100} />
          <Copy>{i.product_name}</Copy>
          <Copy>
            ✦ {i.sparks} Sparks · ⚡ {i.thunder} Thunder Sparks · {i.supporters}{" "}
            supporters
          </Copy>
          <Copy small>{i.concern}</Copy>
          <Pill>
            {i.creator_id
              ? i.accepted
                ? "Creator accepted"
                : "Awaiting creator confirmation"
              : "Creator not assigned"}
          </Pill>
          <Button
            quiet
            label="Review scope & research →"
            onPress={() => r.push(`/team/research?id=${i.id}` as Href)}
          />
          {i.status !== "published" ? (
            <>
              <Heading>Assign creator</Heading>
              {creators.data?.map((c) => (
                <Button
                  quiet
                  key={c.user_id}
                  disabled={action.isPending}
                  label={`${(selected[i.id] || i.creator_id) === c.user_id ? "●" : "○"} ${c.display_name} · ${c.specialties.join(", ")}`}
                  onPress={() =>
                    setSelected({ ...selected, [i.id]: c.user_id })
                  }
                />
              ))}
              <Button
                disabled={action.isPending || !(selected[i.id] || i.creator_id)}
                label="Save assignment invitation"
                onPress={() =>
                  action.mutate(() =>
                    api.assign(
                      i.id,
                      selected[i.id] || i.creator_id!,
                      "selected",
                    ),
                  )
                }
              />
              {i.creator_id && i.accepted ? (
                <Button
                  quiet
                  disabled={action.isPending}
                  label="Mark investigating"
                  onPress={() =>
                    action.mutate(() =>
                      api.assign(i.id, i.creator_id!, "investigating"),
                    )
                  }
                />
              ) : null}
            </>
          ) : (
            <Button
              quiet
              label="View public investigation"
              onPress={() => r.push(`/investigation/${i.id}` as Href)}
            />
          )}
        </Card>
      ))}
      {q.data?.pages[0]?.length === 0 ? (
        <Copy>No cases in this queue.</Copy>
      ) : null}
      {q.hasNextPage ? (
        <Button
          quiet
          disabled={q.isFetchingNextPage}
          label="Load more"
          onPress={() => void q.fetchNextPage()}
        />
      ) : null}
      <ActionResult action={action} />
      <Button
        quiet
        label="Manage creators"
        onPress={() => r.push("/team/creators")}
      />
    </TeamPage>
  );
}
