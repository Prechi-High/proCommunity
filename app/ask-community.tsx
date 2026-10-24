import { Field } from "@/components/community-v2/ui";
import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as living from "@/lib/living/api";
import { CommunityPage } from "@/components/community-v2/ui";
import { Button, Busy, Card, Heading } from "@/components/unmask/reference/ui";
export default function ChooseQuestionProduct() {
  const r = useRouter();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  return (
    <CommunityPage title="What product is on your mind?">
      <Field label="Find your product" value={search} onChange={setSearch} />
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data
        ?.filter((p) =>
          `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 20)
        .map((p) => (
          <Card key={p.id}>
            <Heading>{p.name}</Heading>
            <Button
              label="Ask about this product"
              onPress={() => r.push(`/product/${p.id}/ask-community` as Href)}
            />
          </Card>
        ))}
      <Button
        quiet
        label="Search all products"
        onPress={() => r.push("/unmask" as Href)}
      />
    </CommunityPage>
  );
}
