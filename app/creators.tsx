import { useLocalSearchParams } from "expo-router";
import { CommunityPage } from "@/components/community-v2/ui";
import { Creators } from "@/components/community-v2/Creators";
import { PausedLayer } from "@/components/movement/PausedLayer";
import { PublicProfile } from "@/components/profiles/PublicProfile";
import { features } from "@/lib/features";

function CreatorsRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (id) return <PublicProfile key={id} id={id} creatorOnly />;
  return (
    <CommunityPage
      title="Meet the curious minds."
      sub="Follow the people bringing product questions into focus."
    >
      <Creators />
    </CommunityPage>
  );
}

export default function CreatorsPage() {
  if (!features.creatorStudio) return <PausedLayer surface="creator" />;
  return <CreatorsRoute />;
}
