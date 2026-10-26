import { useEffect, useState } from "react";
import { Text, View, Switch } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionButton,
  AppShell,
  StatusMessage,
  ContentSkeleton,
  FilterChips,
} from "@/components/unmask-ui";
import { ProductIdentity } from "@/components/community/ProductIdentity";
import { Input, Label, Note } from "@/components/tracking/Fields";
import { useTrackingDraft } from "@/lib/tracking/draft";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import { getKnownProduct } from "@/lib/products";
import { hapticSaved } from "@/lib/haptics";
import { useAppStore } from "@/lib/store";
import { fonts, colors } from "@/constants/theme";
export default function AskAboutProduct() {
  const { id, q, name } = useLocalSearchParams<{
    id: string;
    q?: string;
    name?: string;
  }>();
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const known = getKnownProduct(id);
  const product = useQuery({
    queryKey: ["catalog", id],
    queryFn: () => living.catalog(id),
  });
  const p = product.data?.[0];
  const title = p?.name || known?.name || name || "This product";
  const image = p?.image_url || known?.heroImageUrl;
  const beauty =
    /skin|beauty|cosmetic|body|hair|face|cream|serum|cleanser/i.test(
      `${p?.category || known?.category || ""} ${title}`,
    );
  const pref = useQuery({
    queryKey: ["tracking-skin", uid],
    queryFn: clarity.preferences,
    enabled: !!uid,
  });
  const draft = useTrackingDraft(`unmask:question:${uid || "guest"}:${id}`, {
    body: q || "",
    skin: "",
    context: "",
    audience: "everyone",
  });
  const d = draft.value;
  const set = (patch: Partial<typeof d>) =>
    draft.setValue((v) => ({ ...v, ...patch }));
  useEffect(() => {
    if (draft.ready && pref.data?.skin_type && !d.skin && !draft.restored)
      set({ skin: pref.data.skin_type });
  }, [pref.data, draft.ready]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  async function post() {
    if (!uid) {
      r.push({
        pathname: "/(auth)/sign-in",
        params: { returnTo: `/product/${id}/ask-community` },
      } as Href);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await living.registerProduct({
        id,
        name: title,
        brand: p?.brand || known?.brand || "",
        category: p?.category || known?.category || "Product",
        heroImageUrl: image,
      });
      let audience = d.audience === "none" ? "everyone" : d.audience.replace("similar_products", "same_product");
      if (!beauty) audience = audience.replace("_skin", "");
      const out = await living.addQuestion({
        product_id: id,
        body: d.body.trim(),
        context: d.context.trim(),
        skin_type: beauty ? d.skin || null : null,
        audience,
      });
      setDone(out.id);
      hapticSaved(out.id);
      await draft.clear();
      await qc.invalidateQueries({ queryKey: ["product-questions", id] });
      await qc.invalidateQueries({ queryKey: ["home-feed"] });
    } catch (e) {
      setError(
        (e as Error).message || "Your question is still here. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      back
      navigation
      title={
        done ? "Your question is out there." : "Ask people who’ve tried it."
      }
      subtitle={
        done
          ? "A real question. A community that can help."
          : "Keep the product in view. Ask what matters to you."
      }
    >
      <ProductIdentity
        name={title}
        image={image}
        brand={p?.brand || known?.brand}
        loading={product.isLoading && !known}
      />
      {done ? (
        <>
          <StatusMessage
            kind="success"
            title="Posted to the community"
            detail="You’ll get an Unmask notification when someone replies. If you invited an audience, eligible members can receive your question without sharing their private records."
          />
          <ActionButton
            label="View my question"
            onPress={() => r.replace(`/question/${done}` as Href)}
          />
          <ActionButton
            tone="secondary"
            label="Back to product conversations"
            onPress={() => r.replace(`/product/${id}` as Href)}
          />
        </>
      ) : (
        <>
          {id.startsWith("demo-") ? (
            <StatusMessage
              title="Demo product"
              detail="Explore the form. Publishing is available for real products."
            />
          ) : null}
          {!draft.ready ? (
            <ContentSkeleton />
          ) : (
            <>
              <Input
                label="What would you like to know?"
                value={d.body}
                onChange={(v) => set({ body: v })}
                multiline
              />
              {beauty ? (
                <>
                  <Label>Your skin type (optional)</Label>
                  <Note>
                    {pref.data?.skin_type
                      ? "Added from your profile. Change it for this question if needed."
                      : "A little context can make the answers more useful."}{" "}
                    This choice will be visible with your question.
                  </Note>
                  <FilterChips
                    variant="chips"
                    options={[
                      "Not stated",
                      "Dry",
                      "Oily",
                      "Combination",
                      "Normal",
                      "Sensitive",
                    ]}
                    value={d.skin || "Not stated"}
                    onChange={(v) =>
                      set({
                        skin: v === "Not stated" ? "" : v,
                        audience:
                          v === "Not stated"
                            ? d.audience.replace("_skin", "")
                            : d.audience,
                      })
                    }
                  />
                </>
              ) : null}
              <Input
                label="Anything else they should know? (optional)"
                value={d.context}
                onChange={(v) => set({ context: v })}
                multiline
              />
              <View
                style={{
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: "#F6F3EF",
                  gap: 12,
                }}
              >
                <Label>Who should we ask?</Label>
                <FilterChips
                  options={["Everyone", "People who use this product"]}
                  value={
                    d.audience.startsWith("same_product") ||
                    d.audience.startsWith("similar_products")
                      ? "People who use this product"
                      : "Everyone"
                  }
                  onChange={(v) =>
                    set({
                      audience: `${v === "Everyone" ? "everyone" : "same_product"}${d.audience.endsWith("_skin") && d.skin ? "_skin" : ""}`,
                    })
                  }
                />
                {beauty ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Label>Only people with my skin type</Label>
                      <Note>
                        {d.skin
                          ? `Match ${d.skin.toLowerCase()} skin.`
                          : "Add your skin type above to use this filter."}
                      </Note>
                    </View>
                    <Switch
                      accessibilityLabel="Match invited users by skin type"
                      disabled={!d.skin}
                      value={d.audience.endsWith("_skin")}
                      onValueChange={(v) =>
                        set({
                          audience: v
                            ? `${["none", "everyone"].includes(d.audience) ? "everyone" : d.audience.replace("_skin", "")}_skin`
                            : d.audience.replace("_skin", ""),
                        })
                      }
                    />
                  </View>
                ) : null}
                <Note>
                  Your question stays public. These choices guide who we notify.
                  Private product records are never shown to you. Members can
                  turn invitations off.
                </Note>
              </View>
              {error ? (
                <StatusMessage
                  kind="error"
                  title="Not posted yet"
                  detail={error}
                />
              ) : null}
              <ActionButton
                label="Post my question"
                pending={busy}
                disabled={
                  d.body.trim().length < 10 ||
                  d.body.length > 2000 ||
                  id.startsWith("demo-")
                }
                onPress={() => void post()}
              />
              <Note>
                Your question includes the product above. You’ll receive reply
                updates in Notifications.
              </Note>
              <ActionButton
                tone="ghost"
                label="Read existing product conversations"
                onPress={() => r.push(`/product/${id}` as Href)}
              />
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
