import { AppShell } from "@/components/unmask-ui";
import { LivingFeed } from "@/components/social/LivingFeed";

export default function Community() {
  return (
    <AppShell notify flush ambient="socialNight">
      <LivingFeed />
    </AppShell>
  );
}
