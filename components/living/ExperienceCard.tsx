import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as api from "@/lib/living/api";
import type { Experience } from "@/lib/living/types";
import { useAppStore } from "@/lib/store";
import { colors as c, fonts as f } from "@/constants/theme";
import {
  ActionStatus,
  Body,
  Button,
  Card,
  Tag,
  design,
  useAction,
  useLivingQuery,
} from "./ui";
import { FollowButton } from "./FollowButton";
export function ExperienceCard({
  item,
  productLink = true,
}: {
  item: Experience;
  productLink?: boolean;
}) {
  const router = useRouter();
  const action = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const uid = useAppStore((s) => s.profile?.id);
  const photo = useLivingQuery(
    ["photo", item.photo_path],
    () => api.photoUrl(item.photo_path!),
    !!item.photo_path,
  );
  return (
    <Card>
      <View
        style={[
          design.row,
          { justifyContent: "space-between", flexWrap: "wrap" },
        ]}
      >
        <Pressable
          onPress={() =>
            router.push(`/experiences?person=${item.user_id}` as Href)
          }
        >
          <Text style={{ fontFamily: f.semibold, fontSize: 14, color: c.ink }}>
            {item.author_name}
          </Text>
        </Pressable>
        <Tag
          text={`${item.maturity.replace("_", " ")} experience`}
          tone={item.maturity === "early" ? "gold" : "sage"}
        />
      </View>
      {productLink ? (
        <Pressable
          onPress={() =>
            router.push(`/watch/${encodeURIComponent(item.product_id)}` as Href)
          }
        >
          <Text style={[design.title, { fontSize: 25 }]}>
            {item.product_name}
          </Text>
        </Pressable>
      ) : null}
      <Text style={design.small}>
        {item.acquisition.replace("_", " ")} · {item.claimed_days} days reported
        · {item.documented_days} days documented
      </Text>
      <View style={{ borderLeftWidth: 3, borderColor: c.marker, paddingLeft: 16, gap: 7 }}><Text style={design.label}>WHAT CHANGED</Text><Text style={[design.body, { color: c.ink }]}>{item.changed}</Text></View>
      {item.unchanged ? <View style={{ backgroundColor: c.lac2, padding: 14, borderRadius: 12, gap: 5 }}><Text style={design.label}>WHAT STAYED THE SAME</Text><Body>{item.unchanged}</Body></View> : null}
      {item.reaction ? <View style={{ backgroundColor: c.coralSoft, padding: 14, borderRadius: 12, gap: 5 }}><Text style={[design.label, { color: c.coral }]}>REACTION REPORTED</Text><Body>{item.reaction}</Body></View> : null}
      {item.uncertainty ? (
        <Body>Still uncertain: {item.uncertainty}</Body>
      ) : null}
      {item.context ? (
        <Text style={design.small}>Context: {item.context}</Text>
      ) : null}
      {photo.data ? (
        <Image
          source={{ uri: photo.data }}
          resizeMode="cover"
          style={{ width: "100%", height: 230, borderRadius: 12 }}
        />
      ) : null}
      {item.trust_explanation ? <Text style={design.small}>{item.trust_explanation}</Text> : null}
      <Text style={design.small}>
        {new Date(item.created_at).toLocaleDateString()} · {item.visibility} ·{" "}
        {item.would_rebuy === null
          ? "Repurchase undecided"
          : item.would_rebuy
            ? "Would buy again"
            : "Would not buy again"}
      </Text>
      <View style={[design.row, { flexWrap: "wrap" }]}>
        {uid !== item.user_id ? (
          <>
            <Button
              quiet
              disabled={action.isPending}
              label={`Helpful · ${item.helpful_count}`}
              onPress={() => action.run(() => api.toggleHelpful(item.id))}
            />
            <FollowButton type="person" id={item.user_id} />
          </>
        ) : (
          <Button
            quiet
            label={confirmDelete ? "Confirm deletion" : "Delete update"}
            onPress={() =>
              confirmDelete
                ? action.run(() => api.removeExperience(item.id))
                : setConfirmDelete(true)
            }
          />
        )}
        <Button
          quiet
          label="Ask about this"
          onPress={() =>
            router.push(
              `/watch/${encodeURIComponent(item.product_id)}?ask=1` as Href,
            )
          }
        />
      </View>
      <ActionStatus action={action} />
    </Card>
  );
}
