import { Text, View } from "react-native";
import { MediaFrame, ContentSkeleton } from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
export function ProductIdentity({
  name,
  brand,
  image,
  loading,
}: {
  name: string;
  brand?: string | null;
  image?: string | null;
  loading?: boolean;
}) {
  if (loading) return <ContentSkeleton rows={1} />;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
        backgroundColor: "#F5EFE9",
        padding: 14,
        borderRadius: 22,
      }}
    >
      <View style={{ width: 88 }}>
        <MediaFrame uri={image} label={name} ratio={1} corners={false} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 11,
            color: colors.brand,
          }}
        >
          THE PRODUCT WE’RE TALKING ABOUT
        </Text>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 19,
            lineHeight: 25,
            color: colors.ink,
          }}
        >
          {name}
        </Text>
        {brand ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: colors.inkSoft,
            }}
          >
            {brand}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
