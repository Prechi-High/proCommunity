import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import { ProfileIdentity } from "@/components/profiles/Identity";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Pill,
} from "@/components/unmask/reference/ui";
import { FollowButton } from "@/components/living/FollowButton";
import * as api from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";
export default function People() {
  const user = useAppStore((s) => s.profile);
  const p = useLocalSearchParams<{ tab: string }>();
  const [tab, setTab] = useState(
    p.tab === "Followers" ? "Followers" : "Following",
  );
  const [search, setSearch] = useState("");
  const r = useRouter();
  const q = useQuery({
    queryKey: ["profile-people", user?.id, tab],
    queryFn: () => api.people(tab === "Followers"),
    enabled: !!user,
  });
  const rows = q.data?.filter((p) =>
    `${p.display_name} ${p.handle}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <UtilityPage
      title="Your community"
      sub="Follow people to keep up with their public contributions."
    >
      {!user ? (
        <SignInCard />
      ) : (
        <>
          <Chips
            options={["Following", "Followers"]}
            value={tab}
            onChange={setTab}
          />
          <Field label="Search people" value={search} onChange={setSearch} />
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          {rows?.map((p) => (
            <Card key={p.user_id}>
              <ProfileIdentity
                name={p.display_name}
                handle={p.handle}
                avatar={p.avatar_url}
              />
              <Pill>{p.is_creator ? "Unmask Creator" : "Unmasker"}</Pill>
              <Button
                quiet
                label="View profile"
                onPress={() => r.push(`/member/${p.user_id}` as Href)}
              />
              <FollowButton type="person" id={p.user_id} />
            </Card>
          ))}
          {rows?.length === 0 ? (
            <Copy>
              {search
                ? "No people match your search."
                : `No ${tab.toLowerCase()} yet.`}
            </Copy>
          ) : null}
          <Copy small>
            Showing up to 200 people. Your relationship list is private to you.
          </Copy>
        </>
      )}
      <Card>
        <Copy>Find your next curious mind.</Copy>
        <Button label="Discover creators" onPress={() => r.push("/creators")} />
      </Card>
    </UtilityPage>
  );
}
