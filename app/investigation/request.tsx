import { EvidencePicker } from "@/components/tracking/EvidencePicker";
import { ProductIdentity } from "@/components/community/ProductIdentity";
import type { EvidenceSelection } from "@/lib/tracking/api";
import { searchCommunityProducts } from "@/lib/unmask/communitySearch";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  ActionButton,
  ActionSheet,
  AppShell,
  StatusMessage,
  SearchField,
  MediaFrame,
  ContentSkeleton,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import * as api from "@/lib/investigations/api";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import { hapticSaved } from "@/lib/haptics";
import { useAppStore } from "@/lib/store";

export default function RequestUnmask() {
  const p = useLocalSearchParams<{
    product?: string;
    question?: string;
    experience?: string;
    q?: string;
  }>();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [productId, setProductId] = useState(p.product || "");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [attachment, setAttachment] = useState<EvidenceSelection | null>(null);
  const matches = useQuery({
    queryKey: ["ultra-product-search", search],
    queryFn: () => searchCommunityProducts(search),
    enabled: search.trim().length > 1,
  });
  const [title, setTitle] = useState(p.q || "");
  const [concern, setConcern] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const products = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const story = useQuery({
    queryKey: ["clarity-experience", p.experience],
    queryFn: () => community.experience(p.experience!),
    enabled: !!p.experience,
  });
  const selected = useQuery({
    queryKey: ["catalog", productId],
    queryFn: () => living.catalog(productId),
    enabled: !!productId,
  });
  const product =
    products.data?.find((x) => x.id === productId) || selected.data?.[0];
  const submit = async () => {
    if (!uid) {
      router.push("/(auth)/sign-in" as Href);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const linkedProduct =
        product || matches.data?.find((x) => x.id === productId);
      if (linkedProduct)
        await living.registerProduct({
          id: linkedProduct.id,
          name: linkedProduct.name,
          brand: linkedProduct.brand || "",
          category: linkedProduct.category || "Product",
          heroImageUrl:
            "image_url" in linkedProduct
              ? linkedProduct.image_url
              : linkedProduct.heroImageUrl,
        });
      const out = await api.create({
        title: title.trim(),
        concern: concern.trim() || title.trim(),
        supporting_links: "",
        product_id: productId || null,
        attached_journey_id:
          attachment?.kind === "journey" ? attachment.id : null,
        attached_experience_id:
          attachment?.kind === "experience" ? attachment.id : null,
        question_id: p.question || null,
        experience_id: p.experience || null,
      });
      hapticSaved(out.id);
      router.replace(`/investigation/${out.id}` as Href);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to open this Unmask.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell back title={COPY.requestUnmask} subtitle={COPY.requestPrompt}>
      {product ? (
        <ProductIdentity
          name={product.name}
          brand={product.brand}
          image={product.image_url}
        />
      ) : null}
      <ActionButton
        tone="secondary"
        label={product ? "Change tagged product" : "Tag a product"}
        onPress={() => setPicker(true)}
      />
      <ActionSheet
        open={picker}
        onClose={() => setPicker(false)}
        title="Which product?"
      >
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search product name or brand"
        />
        {(search.trim().length > 1 ? matches.isLoading : products.isLoading) ? (
          <ContentSkeleton />
        ) : null}
        {(search.trim().length > 1
          ? matches.data?.map((x) => ({ ...x, image_url: x.heroImageUrl }))
          : products.data
        )
          ?.slice(0, 15)
          .map((x) => (
            <Pressable
              key={x.id}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${x.name}`}
              onPress={() => {
                setProductId(x.id);
                setPicker(false);
              }}
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 12,
                alignItems: "center",
              }}
            >
              <View style={{ width: 60 }}>
                <MediaFrame uri={x.image_url} label={x.name} ratio={1} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.semibold,
                  color: colors.ink,
                }}
              >
                {x.name}
              </Text>
            </Pressable>
          ))}
        {matches.isError ? (
          <ActionButton
            label="Retry search"
            onPress={() => void matches.refetch()}
          />
        ) : null}
      </ActionSheet>
      <EvidencePicker
        value={attachment}
        onChange={(source) => {
          setAttachment(source);
          if (!productId && source?.productId) setProductId(source.productId);
        }}
      />

      {story.data ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 24,
            color: colors.inkSoft,
          }}
        >
          Linked story: {story.data.body.slice(0, 140)}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 14,
          color: colors.brand,
        }}
      >
        What do you need to know — and why?
      </Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        multiline
        placeholder="Why did this happen? Will it keep working? What should I have known?"
        placeholderTextColor={colors.bone3}
        style={{
          fontFamily: fonts.regular,
          fontSize: 16,
          lineHeight: 24,
          minHeight: 80,
          color: colors.ink,
        }}
      />
      <TextInput
        value={concern}
        onChangeText={setConcern}
        multiline
        placeholder="Any extra context (optional)"
        placeholderTextColor={colors.bone3}
        style={{
          fontFamily: fonts.regular,
          fontSize: 16,
          lineHeight: 24,
          minHeight: 72,
          color: colors.ink,
        }}
      />
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 14,
          lineHeight: 20,
          color: colors.inkSoft,
        }}
      >
        Your question opens for community support. The team reviews its scope
        and assigns an Unmask Creator. Support does not guarantee a company
        response or a particular conclusion. Choosing a creator is coming later.
      </Text>
      {error ? (
        <StatusMessage
          kind="error"
          title="Request didn’t open."
          detail={error}
        />
      ) : null}
      <ActionButton
        label="Start an Ultra Unmask"
        pending={busy}
        disabled={title.trim().length < 10}
        explanation={
          title.trim().length < 10
            ? "Write a slightly fuller question."
            : undefined
        }
        onPress={() => void submit()}
      />
    </AppShell>
  );
}
