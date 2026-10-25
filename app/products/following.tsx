import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { ProductsPage } from "@/components/my-products/Page";
import { SignInCard } from "@/components/utilities/Page";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import { FollowButton } from "@/components/living/FollowButton";
import { useAppStore } from "@/lib/store";
import * as living from "@/lib/living/api";
import { followedActivity } from "@/lib/my-products/api";
export default function FollowedActivity() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [product, setProduct] = useState("All");
  const [manage, setManage] = useState(false);
  const subs = useQuery({
    queryKey: ["living", "subscriptions", uid],
    queryFn: living.subscriptions,
    enabled: !!uid,
  });
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const ids = (subs.data ?? [])
    .filter((s) => s.target_type === "product")
    .map((s) => s.target_id)
    .sort();
  const q = useQuery({
    queryKey: ["followed-product-activity", uid, ids],
    queryFn: () => followedActivity(ids),
    enabled: !!uid && subs.isSuccess,
  });
  const names = [
    "All",
    ...new Set(
      ids.map((id) => catalog.data?.find((p) => p.id === id)?.name || id),
    ),
  ];
  const rows = q.data?.filter(
    (i) =>
      product === "All" ||
      (catalog.data?.find((p) => p.id === i.product_id)?.name ||
        i.product_id) === product,
  );
  return (
    <ProductsPage
      title="Updates worth following."
      sub="New experiences, investigations and questions from products you follow."
    >
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Chips options={names} value={product} onChange={setProduct} />
          <Busy
            loading={subs.isLoading || q.isLoading || catalog.isLoading}
            error={subs.error || q.error || catalog.error}
            retry={() => {
              void subs.refetch();
              void q.refetch();
              void catalog.refetch();
            }}
          />
          {rows?.map((i) => {
            const p = catalog.data?.find((p) => p.id === i.product_id);
            return (
              <Card key={i.id}>
                <Photo uri={p?.image_url} size={100} />
                <Heading>{p?.brand || p?.name || "Followed product"}</Heading>
                <Copy muted>{p?.name}</Copy>
                <Pill>{i.type}</Pill>
                <Heading>{i.title}</Heading>
                <Copy>{i.body}</Copy>
                <Button
                  label={
                    i.type === "Published investigation"
                      ? "Watch findings →"
                      : i.type === "New community question"
                        ? "Join discussion →"
                        : "Read experience →"
                  }
                  onPress={() => r.push(i.route as Href)}
                />
                <Button
                  quiet
                  label="Product & follow preferences"
                  onPress={() => r.push(`/product/${i.product_id}` as Href)}
                />
              </Card>
            );
          })}
          {rows?.length === 0 ? (
            <Card>
              <Copy>
                {ids.length
                  ? "No public activity in this view yet."
                  : "Follow a product to see its updates here."}
              </Copy>
              <Button
                label="Explore products"
                onPress={() => r.push("/unmask")}
              />
            </Card>
          ) : null}
          <Copy small>
            Recent activity is limited to 40 items of each type. Published
            investigations use their request date for ordering.
          </Copy>
          <Button
            quiet
            label="Manage followed products"
            onPress={() => setManage(!manage)}
          />
          {manage
            ? ids.map((id) => (
                <Card key={id}>
                  <Copy>
                    {catalog.data?.find((p) => p.id === id)?.name || id}
                  </Copy>
                  <FollowButton type="product" id={id} />
                </Card>
              ))
            : null}
          <Card>
            <Heading>Have something new to add?</Heading>
            <Copy>Share your experience, a tip or a question.</Copy>
            <Button
              quiet
              label="Share an update →"
              onPress={() => r.push("/products/timeline")}
            />
          </Card>
        </>
      )}
    </ProductsPage>
  );
}
