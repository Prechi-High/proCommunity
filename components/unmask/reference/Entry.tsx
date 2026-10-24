import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import {
  Camera,
  MagnifyingGlass,
  Leaf,
  Drop,
  Package,
  ImageSquare,
  CaretRight,
} from "@/components/icons";
import { useAppStore } from "@/lib/store";
import { useScan } from "@/lib/useScan";
import { Header, Heading, Photo, Copy, Card, Button, ink, s } from "./ui";
export function UnmaskEntry() {
  const r = useRouter();
  const [query, setQuery] = useState("");
  const scan = useScan();
  const recent = useAppStore((x) => x.recentProductIds);
  const known = useAppStore((x) => x.knownProducts);
  const search = (q = query) => {
    if (!q.trim()) return;
    useAppStore.getState().addSearch(q.trim());
    r.push({ pathname: "/results", params: { q: q.trim() } });
  };
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { gap: 22 }]}
      >
        <Header wordmarkLarge />
        <Text style={[s.eyebrow, { textAlign: "center", letterSpacing: 3 }]}>
          KNOW BEFORE YOU BUY.
        </Text>
        <Heading hero>Search products{"\n"}or brands.</Heading>
        <Copy muted>
          Get clear insights from real experiences, before you buy.
        </Copy>
        <View style={[s.row, s.input, { borderRadius: 16 }]}>
          <MagnifyingGlass size={25} color={ink.brand} />
          <TextInput
            accessibilityLabel="Search products or brands"
            placeholder="Search products or brands…"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => search()}
            returnKeyType="search"
            style={[s.body, { flex: 1, minHeight: 40 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={() => search()}
          >
            <CaretRight size={24} color={ink.brand} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a product"
          disabled={scan.busy}
          onPress={scan.openCamera}
          style={[
            s.card,
            s.row,
            { backgroundColor: ink.brand, borderRadius: 16, padding: 22 },
          ]}
        >
          <Camera size={36} color="white" />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={[s.heading, { color: "white" }]}>Scan a product</Text>
            <Text style={[s.body, { color: "white" }]}>
              Photograph the label to find the product.
            </Text>
          </View>
          <CaretRight size={24} color="white" />
        </Pressable>
        <Button
          quiet
          label="Choose a photo from your gallery"
          onPress={scan.openUpload}
          disabled={scan.busy}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            ["Skincare", Leaf],
            ["Body care", Drop],
            ["Hair care", ImageSquare],
            ["Electronics", Package],
          ].map(([label, Icon]) => {
            const I = Icon as typeof Leaf;
            return (
              <Pressable
                key={String(label)}
                accessibilityRole="button"
                onPress={() => search(String(label))}
                style={[
                  s.card,
                  {
                    flex: 1,
                    padding: 10,
                    alignItems: "center",
                    backgroundColor: ink.tint,
                  },
                ]}
              >
                <I size={27} color={ink.brand} />
                <Copy small>{String(label)}</Copy>
              </Pressable>
            );
          })}
        </View>
        <Heading>Recently viewed</Heading>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.row}>
            {recent
              .map((id) => known[id])
              .filter(Boolean)
              .slice(0, 8)
              .map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() =>
                    r.push({
                      pathname: "/product/[id]",
                      params: { id: p.id, q: p.name },
                    } as Href)
                  }
                  style={[s.card, { width: 150, padding: 12 }]}
                >
                  <Photo uri={p.heroImageUrl} size={120} />
                  <Copy>{p.name}</Copy>
                </Pressable>
              ))}
          </View>
        </ScrollView>
        {!recent.some((id) => known[id]) ? (
          <Copy muted>Your recently viewed products will appear here.</Copy>
        ) : null}
        <Card style={{ backgroundColor: ink.tint }}>
          <Heading>Share an experience.</Heading>
          <Copy>Help other Unmaskers understand what you have tried.</Copy>
          <Button
            quiet
            label="Share your experience"
            onPress={() => r.push("/contribute" as Href)}
          />
        </Card>
      </ScrollView>
      {scan.sheet}
    </SafeAreaView>
  );
}
