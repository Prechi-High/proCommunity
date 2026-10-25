import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Button,
  Card,
  Copy,
  Heading,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import { FollowButton } from "@/components/living/FollowButton";
import type { BrowseItem } from "@/lib/today/api";
export function InvestigationCard({
  item,
  compact = false,
}: {
  item: BrowseItem;
  compact?: boolean;
}) {
  const r = useRouter();
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        {item.product_image ? (
          <Photo uri={item.product_image} size={compact ? 70 : 100} />
        ) : null}
        <View style={{ flex: 1, gap: 8 }}>
          {item.product_name ? <Copy small>{item.product_name}</Copy> : null}
          <Heading>{item.title}</Heading>
          <Pill>{item.status}</Pill>
          {!compact ? (
            <>
              {item.starter_name ? (
                <Button
                  quiet
                  label={`Started by ${item.starter_name}`}
                  onPress={() => r.push(`/member/${item.user_id}` as Href)}
                />
              ) : null}
              {item.creator_name ? (
                <Button
                  quiet
                  label={`${item.creator_name} · View creator`}
                  onPress={() =>
                    r.push(`/creators?id=${item.creator_id}` as Href)
                  }
                />
              ) : (
                <Copy small>Creator not assigned</Copy>
              )}
            </>
          ) : null}
        </View>
      </View>
      <Copy>
        ✦ {item.sparks.toLocaleString()} Sparks · ⚡{" "}
        {item.thunder.toLocaleString()} Thunder Sparks ·{" "}
        {item.supporters.toLocaleString()} supporters
      </Copy>
      <Button
        label="View investigation"
        onPress={() => r.push(`/investigation/${item.id}` as Href)}
      />
      {!compact ? (
        <>
          <Button
            quiet
            label="Add support"
            onPress={() =>
              r.push(`/investigation/${item.id}?support=1` as Href)
            }
          />
          <FollowButton type="investigation" id={item.id} />
        </>
      ) : null}
    </Card>
  );
}
