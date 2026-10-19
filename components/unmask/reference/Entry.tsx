import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import {
  Camera,
  CaretRight,
  ImageSquare,
  MagnifyingGlass,
} from "@/components/icons";
import { fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import { useScan } from "@/lib/useScan";
import { Header, Heading, Photo, Copy, ink, s } from "./ui";
export function UnmaskEntry() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const scan = useScan();
  const recent = useAppStore((x) => x.recentProductIds);
  const known = useAppStore((x) => x.knownProducts);
  const go = () => {
    if (!query.trim()) return;
    useAppStore.getState().addSearch(query.trim());
    router.push({ pathname: "/results", params: { q: query.trim() } });
  };
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingTop: 16, gap: 20 }]}
      >
        <Header wordmarkLarge />
        <View style={{ marginTop: 20 }}>
          <Heading hero>What are you curious about?</Heading>
        </View>
        <View
          style={[
            s.row,
            {
              borderWidth: 1,
              borderColor: ink.line,
              borderRadius: 99,
              minHeight: 53,
              paddingHorizontal: 17,
            },
          ]}
        >
          <MagnifyingGlass size={24} color={ink.brand} />
          <TextInput
            accessibilityLabel="Search product or brand"
            placeholder="Search product or brand"
            placeholderTextColor={ink.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={go}
            returnKeyType="search"
            style={{
              flex: 1,
              fontFamily: fonts.regular,
              fontSize: 16,
              color: ink.text,
              paddingVertical: 12,
            }}
          />
        </View>
        <View
          style={{
            borderRadius: 19,
            borderWidth: 1,
            borderColor: ink.line,
            minHeight: 214,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
          }}
        >
          <ImageBackground
            source={require("@/assets/unmask-reference/scan-product.png")}
            resizeMode="cover"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "47%",
            }}
          />
          <View style={{ width: "58%", padding: 19, gap: 10 }}>
            <Heading>Scan a product</Heading>
            <Copy muted>
              Instantly look up ingredients and get clear, unbiased information.
            </Copy>
            <Pressable
              disabled={scan.busy}
              accessibilityRole="button"
              onPress={scan.openCamera}
              style={{
                marginTop: 5,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 99,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ink.brand,
              }}
            >
              <Camera size={22} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: "#FFFFFF",
                }}
              >
                Scan a product
              </Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={scan.openUpload}
          disabled={scan.busy}
          style={[s.card, s.row]}
        >
          <ImageSquare size={32} color={ink.brand} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[s.body, { fontFamily: fonts.semibold }]}>
              Upload a photo
            </Text>
            <Copy muted>
              Use a photo from your camera roll to search a product.
            </Copy>
          </View>
          <CaretRight size={20} color={ink.brand} />
        </Pressable>
        <Heading>Recent</Heading>
        {recent
          .map((id) => known[id])
          .filter(Boolean)
          .slice(0, 6)
          .map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: p.id, q: p.name },
                } as Href)
              }
              style={[s.card, s.row, { padding: 9 }]}
            >
              <Photo uri={p.heroImageUrl} size={86} />
              <Text style={[s.body, { flex: 1, fontFamily: fonts.medium }]}>
                {p.name}
              </Text>
              <CaretRight size={21} color={ink.brand} />
            </Pressable>
          ))}
        {!recent.some((id) => known[id]) ? (
          <Copy muted>
            Your recent product investigations will appear here.
          </Copy>
        ) : null}
      </ScrollView>
      {scan.sheet}
    </SafeAreaView>
  );
}
