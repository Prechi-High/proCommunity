import { useQuery } from "@tanstack/react-query";

import { loadCard } from "@/lib/social/api";
import { composeCard } from "@/lib/social/model";
import * as profiles from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";

import { MyUnmaskCard } from "./MyUnmaskCard";

export function OwnUnmaskCard() {
  const profile = useAppStore((state) => state.profile);
  const identity = useQuery({
    queryKey: ["public-identity", profile?.id],
    queryFn: () => profiles.identity(profile!.id),
    enabled: !!profile,
  });
  const card = useQuery({
    queryKey: ["unmask-card", profile?.id, identity.data?.handle],
    enabled: !!profile,
    queryFn: () =>
      loadCard(
        profile!.id,
        true,
        profile!.displayName || identity.data?.display_name || "You",
        identity.data?.handle,
        identity.data?.avatar_url,
      ),
  });
  if (!profile) {
    return <MyUnmaskCard guest card={composeCard({ userId: "guest", name: "Your Unmask" })} />;
  }
  const ready =
    card.data ??
    composeCard({
      userId: profile.id,
      name: profile.displayName || identity.data?.display_name || "You",
      handle: identity.data?.handle,
      avatar: identity.data?.avatar_url ? { uri: identity.data.avatar_url } : null,
    });
  return <MyUnmaskCard self card={ready} />;
}
