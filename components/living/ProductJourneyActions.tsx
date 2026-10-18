import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import type { Product } from "@/lib/types";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import {
  ActionStatus,
  Body,
  Button,
  Card,
  Tag,
  Title,
  useAction,
  useLivingQuery,
} from "./ui";
import { FollowButton } from "./FollowButton";
export function ProductJourneyActions({ product }: { product: Product }) {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const action = useAction();
  const cat = useLivingQuery(["catalog", product.id], () =>
    api.catalog(product.id),
  );
  const mine = useLivingQuery(["journeys"], api.journeys, !!uid);
  const own = mine.data?.find((j) => j.product_id === product.id);
  const open = () => {
    if (cat.data?.length) {
      r.push(`/watch/${encodeURIComponent(product.id)}` as Href);
      return;
    }
    action.run(async () => {
      await api.registerProduct(product);
      r.push(`/watch/${encodeURIComponent(product.id)}` as Href);
    });
  };
  return (
    <Card>
      <Tag text="WHAT HAPPENS AFTER THE PURCHASE" tone="gold" />
      <Title>Keep the story going.</Title>
      <Body>
        Follow new experiences, ask people who have used it, or start your own
        private product journey.
      </Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          label={own ? "My product journey" : "I own this"}
          onPress={() =>
            action.run(async () => {
              await api.registerProduct(product);
              r.push(
                (own
                  ? `/journey/${own.id}`
                  : `/journey/new?product=${encodeURIComponent(product.id)}`) as Href,
              );
            })
          }
        />
        <Button quiet label="Evidence timeline & questions" onPress={open} />
        {cat.data?.[0]?.company_id ? (
          <Button
            quiet
            label={`About ${product.brand || "the company"}`}
            onPress={() =>
              r.push(
                `/company/${encodeURIComponent(cat.data![0].company_id!)}` as Href,
              )
            }
          />
        ) : null}
      </View>
      <FollowButton type="product" id={product.id} preferences />
      <ActionStatus action={action} />
    </Card>
  );
}
