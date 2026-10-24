import { useRouter, type Href } from "expo-router";
import { Text, View } from "react-native";
import {
  Body,
  Button,
  Card,
  Page,
  Title,
  Tag,
  design,
  useLivingQuery,
} from "@/components/living/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import { signOutEverywhere } from "@/lib/auth";
import { colors, fonts } from "@/constants/theme";
export default function You() {
  const r = useRouter();
  const p = useAppStore((s) => s.profile);
  const fav = useAppStore((s) => s.favorites);
  const entries = useLivingQuery(
    ["my-clarity-experiences"],
    () => api.experiences(true),
    !!p,
  );
  const subs = useLivingQuery(["subscriptions"], living.subscriptions, !!p);
  return (
    <Page
      eyebrow="YOUR SPACE"
      title={p?.displayName || "A space for your story."}
      sub="Your products, your observations, your choice to share."
    >
      {p ? (
        <>
          <View style={{ alignItems: "center", gap: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.hiSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 40,
                  color: colors.brand,
                }}
              >
                {p.displayName.slice(0, 1)}
              </Text>
            </View>
            <Tag text="Private until you choose to share" />
            <Button
              quiet
              label="Edit profile & context"
              onPress={() => r.push("/clarity-settings" as Href)}
            />
          </View>
          <View style={[design.row, { justifyContent: "space-around" }]}>
            {[
              [
                String(
                  entries.data?.filter((e) => e.visibility === "public")
                    .length ?? "—",
                ),
                "Experiences",
              ],
              [String(fav.length), "Saved products"],
              [String(subs.data?.length ?? "—"), "Following"],
            ].map(([value, label]) => (
              <View key={label} style={{ alignItems: "center", gap: 7 }}>
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 27,
                    color: colors.ink,
                  }}
                >
                  {value}
                </Text>
                <Text style={design.small}>{label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Button label="Sign in" onPress={() => r.push("/(auth)/sign-in")} />
      )}
      <Card>
        <Tag text="YOUR PRODUCT MEMORY" />
        {[
          ["Spark Wallet", "/wallet"],
          ["Contribution history", "/wallet/history"],
          ["Saved items", "/saved-items"],
          ["Settings", "/settings"],
          ["Help & support", "/help"],
          ["My products & routines", "/products"],
          ["Saved products & history", "/saved"],
          ["My research", "/research"],
          ["My contributions", "/contribute?mine=1"],
          ["Following", "/products?section=watching"],
        ].map(([label, path]) => (
          <Button
            key={path}
            quiet
            label={label}
            onPress={() => r.push(path as Href)}
          />
        ))}
      </Card>
      <Title>You are in control.</Title>
      <Button
        quiet
        label="Privacy, profile & preferences"
        onPress={() => r.push("/clarity-settings" as Href)}
      />
      <Button
        quiet
        label="Unmask Together"
        onPress={() => r.push("/together" as Href)}
      />
      <Button
        quiet
        label="Notifications"
        onPress={() => r.push("/notifications" as Href)}
      />
      <Body>
        Searches and scans never become public posts. Only experiences you
        deliberately publish appear in Community.
      </Body>
      {p?.isAdmin ? (
        <Button quiet label="Admin" onPress={() => r.push("/admin" as Href)} />
      ) : null}
      {p ? (
        <Button
          quiet
          label="Sign out"
          onPress={() => void signOutEverywhere()}
        />
      ) : null}
    </Page>
  );
}
