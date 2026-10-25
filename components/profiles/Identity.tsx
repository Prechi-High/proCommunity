import { Image, Text, View } from "react-native";
import { Copy, Heading, ink } from "@/components/unmask/reference/ui";
import { fonts } from "@/constants/theme";
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
      {avatar ? (
        <Image
          source={{ uri: avatar }}
          accessibilityLabel={`${name}'s profile photo`}
          style={{ width: 82, height: 82, borderRadius: 41 }}
        />
      ) : (
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 41,
            backgroundColor: ink.tint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ fontFamily: fonts.serif, fontSize: 42, color: ink.brand }}
          >
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <Heading>{name}</Heading>
        {handle ? <Copy muted>@{handle}</Copy> : null}
        {bio ? <Copy>{bio}</Copy> : null}
      </View>
    </View>
  );
}
