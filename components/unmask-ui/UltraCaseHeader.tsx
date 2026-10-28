import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Lightning, ChatCircle, UsersThree } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { MediaFrame } from "./MediaFrame";
export function UltraCaseHeader({
  title,
  status,
  productName,
  image,
}: {
  title: string;
  status?: string;
  productName?: string | null;
  image?: string | null;
}) {
  return (
    <LinearGradient
      colors={["#542030", "#2C1019"]}
      style={{ padding: 22, borderRadius: 26, gap: 16, borderWidth: 1, borderColor: "#B78D57", boxShadow: "0 0 18px rgba(183,141,87,0.16)" }}
    >
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Lightning size={22} color="#F2D25B" weight="fill" />
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 12,
            letterSpacing: 0.8,
            color: "#F2D25B",
          }}
        >
          ULTRA UNMASK · ACTIVATED
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 25,
          lineHeight: 33,
          color: "#fff",
        }}
      >
        {title}
      </Text>
      <Text
        style={{ fontFamily: fonts.medium, fontSize: 13, color: "#F2D9DC" }}
      >
        {status || "Open for Sparks"}
      </Text>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {image ? (
          <View style={{ width: 64 }}>
            <MediaFrame
              uri={image}
              label={productName || "Product"}
              ratio={1}
              corners={false}
            />
          </View>
        ) : null}
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.regular,
            fontSize: 14,
            lineHeight: 22,
            color: "#F0DDE1",
          }}
        >
          {productName ? `${productName}. ` : ""}The community is asking for
          more than a review. A creator can take this question to the company
          and relevant experts.
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { label: "Your experience", Icon: ChatCircle },
          { label: "Community Sparks", Icon: Lightning },
          { label: "Creator follow-through", Icon: UsersThree },
        ].map(({ label, Icon }) => (
          <View
            key={label}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 13,
              backgroundColor: "#FFFFFF14",
              gap: 7,
            }}
          >
            <Icon size={18} color="#E8C87C" />
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 11,
                lineHeight: 16,
                color: "#fff",
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}
