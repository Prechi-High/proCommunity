import { useState } from "react";
import { useRouter, usePathname, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Chips,
  Copy,
  Heading,
  Photo,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import { displayName } from "@/lib/products";
export default function SavedItems() {
  const r = useRouter();
  const path = usePathname();
  const [tab, setTab] = useState("Saved");
  const favorites = useAppStore((s) => s.favorites);
  const recent = useAppStore((s) => s.recentProductIds);
  const known = useAppStore((s) => s.knownProducts);
  const toggle = useAppStore((s) => s.toggleFavorite);
  const ids = tab === "Saved" ? favorites.map((f) => f.productId) : recent;
  return (
    <UtilityPage
      hideNav={path === "/saved"}
      title="Worth coming back to."
      sub="Products you saved and recently explored."
    >
      <Chips
        options={["Saved", "Recently viewed"]}
        value={tab}
        onChange={setTab}
      />
      {ids.map((id) => {
        const p = known[id];
        return (
          <Card key={id}>
            {p?.heroImageUrl ? <Photo uri={p.heroImageUrl} size={90} /> : null}
            <Heading>{p ? displayName(p) : "Saved product"}</Heading>
            <Button
              label="Unmask product"
              onPress={() =>
                r.push({
                  pathname: "/product/[id]",
                  params: { id, q: p ? displayName(p) : undefined },
                } as Href)
              }
            />
            {tab === "Saved" ? (
              <Button
                quiet
                label="Remove from saved"
                onPress={() => toggle(id)}
              />
            ) : null}
          </Card>
        );
      })}
      {ids.length === 0 ? (
        <Card>
          <Heading>
            {tab === "Saved"
              ? "Nothing saved yet."
              : "Your next discovery starts here."}
          </Heading>
          <Copy>
            Save a product from its page to return to its experiences and
            evidence.
          </Copy>
          <Button label="Find a product" onPress={() => r.push("/unmask")} />
        </Card>
      ) : null}
    </UtilityPage>
  );
}
