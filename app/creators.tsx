import { useLocalSearchParams } from "expo-router";
import { CommunityPage } from "@/components/community-v2/ui";
import { Creators } from "@/components/community-v2/Creators";
import { PublicProfile } from "@/components/profiles/PublicProfile";
export default function CreatorsPage() {
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
