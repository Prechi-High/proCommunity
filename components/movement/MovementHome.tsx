import { SocialDoor } from "@/components/social-home/SocialDoor";

/** Logged-out front door. Stories and people first. The First 90 stays a chip. */
export function MovementHome() {
  return <SocialDoor mode="guest" />;
}
