import { useLocalSearchParams } from "expo-router";
import * as api from "@/lib/living/api";
import { Page, Busy, Empty, useLivingQuery } from "@/components/living/ui";
import { ExperienceCard } from "@/components/living/ExperienceCard";
import { FollowButton } from "@/components/living/FollowButton";
export default function PersonExperiences() {
  const { person } = useLocalSearchParams<{ person: string }>();
  const q = useLivingQuery(["person-experiences", person], () =>
    api.experiences({ personId: person }),
  );
  return (
    <Page
      back
      eyebrow="An Unmasker’s observations"
      title={q.data?.[0]?.author_name || "Experience history"}
      sub="Opinions can change. Follow the observations over time, with their context and disclosures."
    >
      {person ? <FollowButton type="person" id={person} /> : null}
      <Busy error={q.error} loading={q.isLoading} />
      {q.data?.map((e) => (
        <ExperienceCard key={e.id} item={e} />
      ))}
      {q.data?.length === 0 ? (
        <Empty
          title="No shared history here yet."
          body="Private experiences stay private. Public and follower-visible updates appear only for their intended audience."
        />
      ) : null}
    </Page>
  );
}
