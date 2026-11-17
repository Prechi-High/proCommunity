import { CommunityQuestionsFeed } from "@/components/social/CommunityQuestionsFeed";
import { AppShell } from "@/components/unmask-ui";
import { VISION_SCREENS } from "@/lib/navigation/visionNav";

export default function CommunityTab() {
  return (
    <AppShell notify flush ambient="socialNight" title={VISION_SCREENS.community.title} subtitle={VISION_SCREENS.community.subtitle}>
      <CommunityQuestionsFeed />
    </AppShell>
  );
}