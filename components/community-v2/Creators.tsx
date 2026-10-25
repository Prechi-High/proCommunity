import { Field } from "@/components/community-v2/ui";
import { useState } from "react";
import { Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import * as api from "@/lib/community-v2/api";
import { FollowButton } from "@/components/living/FollowButton";
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
export function Creators({
  compact = false,
  id,
}: {
  compact?: boolean;
  id?: string;
}) {
  const r = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const q = useQuery({ queryKey: ["creators"], queryFn: api.creators });
  const videos = useQuery({
    queryKey: ["creator-publications", id],
    queryFn: () => api.publications(id),
  });
  const rows = (q.data || [])
    .filter(
      (c) =>
        (!id || c.user_id === id) &&
        `${c.display_name} ${c.handle} ${c.specialties.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (category === "All" || c.specialties.includes(category)),
    )
    .slice(0, compact ? 2 : 100);
  return (
    <>
      {!compact && !id ? (
        <>
          <Field label="Search creators" value={search} onChange={setSearch} />
          <Chips
            options={[
              "All",
              ...new Set((q.data || []).flatMap((c) => c.specialties)),
            ]}
            value={category}
            onChange={setCategory}
          />
        </>
      ) : null}
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {rows.map((c) => (
        <Card key={c.user_id}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Photo uri={c.avatar_url} size={72} />
            <View style={{ flex: 1, gap: 8 }}>
              <Heading>{c.display_name}</Heading>
              <Copy muted>@{c.handle}</Copy>
              <Pill>Unmask Creator</Pill>
            </View>
          </View>
          <Copy>{c.bio}</Copy>
          <Copy small>{c.specialties.join(" · ")}</Copy>
          <FollowButton type="person" id={c.user_id} />
          {!id ? (
            <Button
              quiet
              label="View creator profile"
              onPress={() => r.push(`/creators?id=${c.user_id}` as Href)}
            />
          ) : null}
          <Busy
            loading={videos.isLoading}
            error={videos.error}
            retry={() => void videos.refetch()}
          />
          {(videos.data || [])
            .filter((v) => v.creator_id === c.user_id)
            .slice(0, compact ? 1 : 20)
            .map((v) => (
              <Card key={v.id}>
                {v.thumbnail_url ? (
                  <Photo uri={v.thumbnail_url} size={180} />
                ) : null}
                <Heading>{v.title}</Heading>
                {v.commercial_disclosure ? (
                  <Copy small>
                    Commercial disclosure: {v.commercial_disclosure}
                  </Copy>
                ) : null}
                <Button
                  label="Watch investigation"
                  onPress={() => void Linking.openURL(v.video_url)}
                />
                {v.product_id ? (
                  <Button
                    quiet
                    label="View product"
                    onPress={() => r.push(`/product/${v.product_id}` as Href)}
                  />
                ) : null}
              </Card>
            ))}
          {videos.data &&
          !videos.data.some((v) => v.creator_id === c.user_id) ? (
            <Copy muted>First investigation coming soon.</Copy>
          ) : null}
        </Card>
      ))}
      {q.data && !rows.length ? (
        <Notice>No published creators match yet.</Notice>
      ) : null}
      {compact ? (
        <Button
          quiet
          label="Discover all creators"
          onPress={() => r.push("/creators" as Href)}
        />
      ) : null}
    </>
  );
}
