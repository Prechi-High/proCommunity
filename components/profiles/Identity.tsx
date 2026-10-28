import { View } from "react-native";
import { Avatar } from "@/components/unmask-ui";
import { Copy, Heading } from "@/components/unmask/reference/ui";
export function ProfileIdentity({
  name,
  handle,
  bio,
  avatar,
}: {
  name: string;
  handle?: string;
  bio?: string;
  avatar?: string | null;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
      <Avatar name={name} uri={avatar} size={76} />
      <View style={{ flex: 1, gap: 6 }}>
        <Heading>{name}</Heading>
        {handle ? <Copy muted>@{handle}</Copy> : null}
        {bio ? <Copy>{bio}</Copy> : null}
      </View>
    </View>
  );
}
