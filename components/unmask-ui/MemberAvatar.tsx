import { View } from "react-native";
import { Avatar } from "./Avatar";
import { colors } from "@/constants/theme";

export function MemberAvatar({ name, uri, size = 56, claimed = false, preview = false }: {
  name?: string | null; uri?: string | null; size?: number; claimed?: boolean; preview?: boolean;
}) {
  return <View accessibilityLabel={claimed ? "Unmasker member ring" : preview ? "Preview of the Unmasker ring" : undefined}
    style={{ padding: 4, borderWidth: claimed || preview ? 2 : 0, borderColor: colors.brandDeep,
      borderRadius: 100, borderStyle: preview ? "dashed" : "solid", alignSelf: "flex-start" }}>
    <Avatar name={name} uri={uri} size={size} />
  </View>;
}
