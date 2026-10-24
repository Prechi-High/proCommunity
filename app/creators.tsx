import { useLocalSearchParams } from "expo-router";
import { CommunityPage } from "@/components/community-v2/ui";
import { Creators } from "@/components/community-v2/Creators";
export default function CreatorDirectory() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <CommunityPage
      title={id ? "Unmask Creator" : "Meet the curious minds."}
      sub="Follow the people bringing product questions into focus."
    >
      <Creators id={id} />
    </CommunityPage>
  );
}
