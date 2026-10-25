import { useState } from "react";
import { Linking, Share } from "react-native";
import * as ExpoLinking from "expo-linking";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { ProfileIdentity } from "./Identity";
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
import { FollowButton } from "@/components/living/FollowButton";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/profiles/api";
import * as community from "@/lib/community-v2/api";
export function PublicProfile({
  id,
  creatorOnly = false,
}: {
  id: string;
  creatorOnly?: boolean;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const [tab, setTab] = useState(
    creatorOnly ? "Investigations" : "Experiences",
  );
  const [error, setError] = useState("");
  const identity = useQuery({
    queryKey: ["public-identity", id],
    queryFn: () => api.identity(id),
    enabled: !!id,
  });
  const counts = useQuery({
    queryKey: ["profile-counts", id, uid],
    queryFn: () => api.counts(id),
    enabled: !!id,
  });
  const experiences = useQuery({
    queryKey: ["profile-experiences", id],
    queryFn: () => api.experiences(id),
    enabled: !!id,
  });
  const questions = useQuery({
    queryKey: ["profile-questions", id],
    queryFn: () => api.questions(id),
    enabled: !!id,
  });
  const support = useQuery({
    queryKey: ["profile-support", id],
    queryFn: () => api.support(id),
    enabled: !!id,
  });
  const creators = useQuery({
    queryKey: ["creators"],
    queryFn: community.creators,
  });
  const videos = useQuery({
    queryKey: ["creator-publications", id],
    queryFn: () => community.publications(id),
    enabled: !!id,
  });
  const p = identity.data;
  const c = creators.data?.find((c) => c.user_id === id);
  const name =
    p?.display_name ||
    c?.display_name ||
    experiences.data?.[0]?.author_name ||
    "Unmasker";
  const bio = p?.bio || c?.bio;
  const options = c
    ? ["Investigations", "Experiences", "About"]
    : ["Experiences", "Questions", "Supported"];
  const active = options.includes(tab) ? tab : options[0];
  const share = async () => {
    try {
      await Share.share({
        message: `${name} on Unmask\n${ExpoLinking.createURL(`/member/${id}`)}`,
      });
    } catch {
      setError("Could not share this profile. Please retry.");
    }
  };
  return (
    <UtilityPage title={c ? "Unmask Creator" : "Public profile"}>
      <Busy
        loading={identity.isLoading || creators.isLoading}
        error={identity.error || creators.error}
        retry={() => {
          void identity.refetch();
          void creators.refetch();
        }}
      />
      <ProfileIdentity
        name={name}
        handle={p?.handle || c?.handle}
        bio={bio}
        avatar={p?.avatar_url || c?.avatar_url}
      />
      {!p && !c && identity.isSuccess && creators.isSuccess ? (
        <Copy muted>This member has not set up a public profile yet.</Copy>
      ) : null}
      {c ? (
        <>
          <Pill>Unmask Creator</Pill>
          <Copy small>
            This person creates content on Unmask. This label does not verify
            expertise or credentials.
          </Copy>
          <Copy>{c.specialties.join(" · ")}</Copy>
        </>
      ) : null}
      {uid === id ? (
        <Button
          quiet
          label="Edit profile"
          onPress={() => r.push("/profile/edit")}
        />
      ) : (
        <FollowButton type="person" id={id} />
      )}
      <Button quiet label="Share profile" onPress={() => void share()} />
      {error ? <Notice>{error}</Notice> : null}
      <Busy
        loading={counts.isLoading}
        error={counts.error}
        retry={() => void counts.refetch()}
      />
      {counts.data?.followers !== undefined ? (
        <Copy>
          {counts.data.followers} followers · {counts.data.following} following
        </Copy>
      ) : null}
      {p?.social_links
        .filter((v) => api.safeLink(v))
        .map((link) => (
          <Button
            quiet
            key={link}
            label={new URL(link).hostname}
            onPress={() =>
              void Linking.openURL(link).catch(() =>
                setError("Could not open this social link."),
              )
            }
          />
        ))}
      <Chips options={options} value={active} onChange={setTab} />
      {active === "Investigations" ? (
        <>
          <Busy
            loading={videos.isLoading}
            error={videos.error}
            retry={() => void videos.refetch()}
          />
          {videos.data?.map((v) => (
            <Card key={v.id}>
              {v.thumbnail_url ? (
                <Photo uri={v.thumbnail_url} size={220} />
              ) : null}
              <Heading>{v.title}</Heading>
              <Button
                label="Watch investigation"
                onPress={() =>
                  void Linking.openURL(v.video_url).catch(() =>
                    setError("Could not open this video."),
                  )
                }
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
          {videos.data?.length === 0 ? (
            <Copy>No published investigations yet.</Copy>
          ) : null}
        </>
      ) : null}
      {active === "Experiences" ? (
        <>
          <Busy
            loading={experiences.isLoading}
            error={experiences.error}
            retry={() => void experiences.refetch()}
          />
          {experiences.data?.map((e) => (
            <Card key={e.id}>
              <Heading>
                {e.unmask_catalog?.name || "Product experience"}
              </Heading>
              {e.unmask_catalog?.image_url ? (
                <Photo uri={e.unmask_catalog.image_url} size={100} />
              ) : null}
              <Copy small>
                {e.duration}
                {e.frequency ? ` · ${e.frequency}` : ""}
                {e.skin_type
                  ? ` · ${e.skin_type} skin, shared voluntarily`
                  : ""}
              </Copy>
              {e.outcome ? <Pill>{e.outcome} experience</Pill> : null}
              <Copy>{e.body}</Copy>
              <Button
                quiet
                label="View experience & replies"
                onPress={() => r.push(`/contribute?experience=${e.id}` as Href)}
              />
            </Card>
          ))}
          {experiences.data?.length === 0 ? (
            <Copy>No public experiences yet.</Copy>
          ) : null}
        </>
      ) : null}
      {active === "Questions" ? (
        <>
          <Busy
            loading={questions.isLoading}
            error={questions.error}
            retry={() => void questions.refetch()}
          />
          {questions.data?.map((q) => (
            <Card key={q.id}>
              <Copy>{q.body}</Copy>
              <Button
                quiet
                label="Join discussion"
                onPress={() => r.push(`/question/${q.id}` as Href)}
              />
            </Card>
          ))}
          {questions.data?.length === 0 ? (
            <Copy>No public questions yet.</Copy>
          ) : null}
        </>
      ) : null}
      {active === "Supported" ? (
        <>
          <Copy small>
            Only support acknowledged publicly is shown. Contribution amounts
            and anonymous support are private.
          </Copy>
          <Busy
            loading={support.isLoading}
            error={support.error}
            retry={() => void support.refetch()}
          />
          {support.data?.map((i) => (
            <Card key={i.id}>
              <Pill>{i.status}</Pill>
              <Heading>{i.title}</Heading>
              <Button
                quiet
                label="View investigation"
                onPress={() => r.push(`/investigation/${i.id}` as Href)}
              />
            </Card>
          ))}
          {support.data?.length === 0 ? (
            <Copy>No publicly acknowledged support to show.</Copy>
          ) : null}
        </>
      ) : null}
      {active === "About" ? (
        <Card>
          <Heading>About {name}</Heading>
          <Copy>{bio || "No bio added yet."}</Copy>
          <Copy>
            Investigations bring experiences, evidence and context together.
            Financial support does not determine findings.
          </Copy>
        </Card>
      ) : null}
    </UtilityPage>
  );
}
