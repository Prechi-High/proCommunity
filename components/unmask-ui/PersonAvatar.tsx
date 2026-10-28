import { Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { memberIdentity, foundingMember } from "@/lib/membership";
import { identity } from "@/lib/profiles/api";
import { MemberAvatar } from "./MemberAvatar";

/** Public identity only: never reads another member's private account context. */
export function PersonAvatar({
  id,
  name,
  uri,
  size = 34,
}: {
  id?: string | null;
  name?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const r = useRouter();
  const real = !!id && /^[0-9a-f-]{36}$/i.test(id);
  const ring = useQuery({
    queryKey: ["member-identity", id],
    queryFn: () => memberIdentity(id!),
    enabled: real,
    staleTime: 60000,
  });
  const founder = useQuery({
    queryKey: ["founding-member", id],
    queryFn: () => foundingMember(id!),
    enabled: real,
    staleTime: 60000,
  });
  const person = useQuery({
    queryKey: ["public-identity", id],
    queryFn: () => identity(id!),
    enabled: real,
    staleTime: 60000,
  });
  const display = person.data?.display_name || name;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${display || "member"}'s profile`}
      disabled={!id}
      onPress={() => r.push(`/member/${id}` as Href)}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <MemberAvatar
        name={display}
        uri={person.data?.avatar_url || uri}
        size={size}
        claimed={!!ring.data}
        founding={!!founder.data}
      />
    </Pressable>
  );
}
