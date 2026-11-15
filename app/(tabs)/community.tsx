import { AppShell } from "@/components/unmask-ui";
import { UpdatesFeed } from "@/components/social/UpdatesFeed";

export default function Updates() {
  return (
    <AppShell notify flush ambient="socialNight" title="Updates" subtitle="24-hour status and moment sections.">
      <UpdatesFeed />
    </AppShell>
  );
}