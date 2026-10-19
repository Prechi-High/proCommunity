import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CaretRight,
  Check,
  MagnifyingGlass,
  X,
} from "@/components/icons";
import { fonts } from "@/constants/theme";
import { rememberProduct, searchProducts } from "@/lib/products";
import { useAppStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import {
  BottomNav,
  Button,
  Busy,
  Card,
  Copy,
  Header,
  Heading,
  Photo,
  Pill,
  ink,
  s,
} from "@/components/unmask/reference/ui";
export default function ResultsScreen() {
  const r = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(q || "");
  const [query, setQuery] = useState(q || "");
  useEffect(() => {
    setDraft(q || "");
    setQuery(q || "");
  }, [q]);
  const result = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchProducts(query),
    enabled: query.trim().length > 1,
    staleTime: 600000,
    retry: 1,
  });
  const submit = () => {
    if (draft.trim()) {
      setQuery(draft.trim());
      useAppStore.getState().addSearch(draft.trim());
    }
  };
  const open = (p: Product) => {
    rememberProduct(p);
    r.push({
      pathname: "/product/[id]",
      params: { id: p.id, q: p.name },
    } as Href);
  };
  const products = result.data?.products || [];
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Header wordmarkLarge />
        <Text style={[s.eyebrow, { textAlign: "center", letterSpacing: 3 }]}>
          PRODUCT CLARITY
        </Text>
        <View style={s.row}>
          <Pressable accessibilityLabel="Back" onPress={() => r.back()}>
            <ArrowLeft size={24} color={ink.text} />
          </Pressable>
          <View style={[s.row, s.input, { flex: 1 }]}>
            <MagnifyingGlass size={22} color={ink.muted} />
            <TextInput
              accessibilityLabel="Search products"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              style={{
                flex: 1,
                fontFamily: fonts.regular,
                fontSize: 15,
                color: ink.text,
              }}
            />
            <Pressable
              onPress={() => setDraft("")}
              accessibilityLabel="Clear search"
            >
              <X size={18} color={ink.muted} />
            </Pressable>
          </View>
        </View>
        <Heading hero>Choose the right product</Heading>
        <Copy muted>Check the formula and size before you continue.</Copy>
        <Busy
          loading={result.isLoading}
          error={result.error}
          retry={() => void result.refetch()}
        />
        <Text style={s.eyebrow}>{products.length} POSSIBLE MATCHES</Text>
        {products.map((p, i) => (
          <Card
            key={p.id}
            style={i === 0 ? { borderColor: ink.brand } : undefined}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => open(p)}
              style={s.row}
            >
              <Photo uri={p.heroImageUrl} size={i === 0 ? 122 : 90} />
              <View style={{ flex: 1, gap: 7 }}>
                {i === 0 ? <Pill>Closest match</Pill> : null}
                <Text
                  style={[
                    s.body,
                    {
                      fontFamily: fonts.semibold,
                      fontSize: 18,
                      lineHeight: 23,
                    },
                  ]}
                >
                  {p.name}
                </Text>
                <Copy muted>{p.brand}</Copy>
                <Copy small>{p.description || p.category}</Copy>
                {i === 0 ? (
                  <View style={s.row}>
                    <Check size={17} color={ink.brand} />
                    <Copy small>
                      Check the name and size match your product
                    </Copy>
                  </View>
                ) : null}
              </View>
              <CaretRight size={20} color={ink.text} />
            </Pressable>
            {i === 0 ? (
              <Button label="This is my product" onPress={() => open(p)} />
            ) : null}
          </Card>
        ))}
        {!products.length && !result.isLoading && !result.error ? (
          <Copy muted>
            No matching product was found. Try a fuller name, brand or model.
          </Copy>
        ) : null}
        <Button
          quiet
          label="None of these? Refine search"
          onPress={() => {
            setDraft("");
            r.back();
          }}
        />
        <Button
          quiet
          label="Request a product"
          onPress={() =>
            r.push({
              pathname: "/request-product",
              params: { q: query },
            } as Href)
          }
        />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
