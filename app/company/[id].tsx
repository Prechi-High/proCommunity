import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Linking } from "react-native";
import * as api from "@/lib/living/api";
import {
  Body,
  Button,
  Busy,
  Card,
  Empty,
  Page,
  ProductTile,
  Tag,
  Title,
  useLivingQuery,
} from "@/components/living/ui";
import { FollowButton } from "@/components/living/FollowButton";
export default function CompanyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRouter();
  const q = useLivingQuery(["company", id], () => api.company(id));
  const products = useLivingQuery(["company-products", id], () =>
    api.companyProducts(id),
  );
  const co = q.data;
  return (
    <Page
      back
      eyebrow="Behind the product"
      title={co?.name || "Company profile"}
      sub="Company statements and independent experiences have different roles. We keep them distinct."
    >
      <Busy loading={q.isLoading} error={q.error} />
      {co ? (
        <>
          <Card>
            <Tag
              text={
                co.verification_status === "verified"
                  ? "Verified company identity"
                  : "Unverified company profile"
              }
              tone="gold"
            />
            <Body>
              {co.description ||
                "This profile connects products already known to Unmask. Company background and official details have not been independently verified yet."}
            </Body>
            {co.country ? <Body>Origin: {co.country}</Body> : null}
            {co.website && /^https:\/\//.test(co.website) ? (
              <Button
                quiet
                label="Official website"
                onPress={() => void Linking.openURL(co.website!)}
              />
            ) : null}
            {co.support_url && /^https:\/\//.test(co.support_url) ? (
              <Button
                quiet
                label="Customer support"
                onPress={() => void Linking.openURL(co.support_url!)}
              />
            ) : null}
            <FollowButton type="company" id={co.id} />
          </Card>
          <Title>Product catalogue</Title>
          {products.data?.map((p) => (
            <ProductTile
              key={p.id}
              name={p.name}
              brand={p.brand}
              image={p.image_url}
              detail={p.category || "Product"}
              onPress={() =>
                r.push(`/watch/${encodeURIComponent(p.id)}` as Href)
              }
            />
          ))}
          <Card tone="gold">
            <Title>Claims & independent evidence</Title>
            <Body>
              Open a product to compare manufacturer claims with user evidence.
              Company identity verification does not verify its product claims.
            </Body>
          </Card>
          <Empty
            title="No official response on record."
            body="Company responses and sponsorship disclosures will be labeled separately when available. Their absence does not imply a partnership or endorsement."
          />
        </>
      ) : null}
    </Page>
  );
}
