import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { CommunityPage } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/investigations/api";
export default function Investigations() {
  const r = useRouter();
  const q = useQuery({
    queryKey: ["investigations"],
    queryFn: () => api.list(),
  });
  return (
    <CommunityPage title="Questions worth pursuing.">
      <Button
        label="Request an Unmask"
        onPress={() => r.push("/investigation/request" as Href)}
      />
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data?.map((i) => (
        <Card key={i.id}>
          <Pill>{i.status}</Pill>
          <Heading>{i.title}</Heading>
          <Copy>{i.concern}</Copy>
          <Button
            label="View investigation"
            onPress={() => r.push(`/investigation/${i.id}` as Href)}
          />
        </Card>
      ))}
      {q.data?.length === 0 ? (
        <Notice>No investigations requested yet.</Notice>
      ) : null}
    </CommunityPage>
  );
}
