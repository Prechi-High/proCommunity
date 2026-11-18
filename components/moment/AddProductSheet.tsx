import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter, type Href } from "expo-router";

import { Camera, MagnifyingGlass, Package, SealCheck } from "@/components/icons";
import { SearchField } from "@/components/unmask-ui/SearchField";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { momentFlow } from "@/lib/moment/flowTheme";
import type { MomentAttachedProduct } from "@/lib/moment/types";
import { extractProductFromPhoto } from "@/lib/productVision";
import type { Product } from "@/lib/types";
import { searchCommunityProducts, popularBeautyProducts } from "@/lib/unmask/communitySearch";
import { useAppStore } from "@/lib/store";

type Mode = "home" | "find" | "mine" | "show";

function pickJourneyId(
  productId: string,
  journeys: Awaited<ReturnType<typeof living.journeys>> | undefined,
): string | undefined {
  return journeys?.find((j) => j.product_id === productId)?.id;
}

export function AddProductSheet({
  open,
  onClose,
  attached,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  attached: MomentAttachedProduct[];
  onAttach: (p: MomentAttachedProduct) => void;
}) {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [mode, setMode] = useState<Mode>("home");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [verifyPending, setVerifyPending] = useState(false);

  const matches = useQuery({
    queryKey: ["moment-product-search", search],
    queryFn: () => searchCommunityProducts(search),
    enabled: mode === "find" && search.trim().length > 1,
  });
  const popular = useQuery({
    queryKey: ["moment-product-popular"],
    queryFn: () => popularBeautyProducts(8),
    enabled: mode === "find" && search.trim().length <= 1,
  });
  const mine = useQuery({
    queryKey: ["living", "journeys", uid, "moment-sheet"],
    queryFn: living.journeys,
    enabled: !!uid && mode === "mine",
  });

  const reset = () => {
    setMode("home");
    setSearch("");
    setPicked(null);
    setVerifyPending(false);
    setScanError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const already = (id: string) => attached.some((p) => p.productId === id);

  async function attachFromCatalog(
    product: Pick<Product, "id" | "name" | "brand" | "category" | "heroImageUrl">,
    verificationState: "confirmed" | "pending",
  ) {
    if (already(product.id)) return;
    try {
      await living.registerProduct(product);
    } catch {
      /* catalogue may already know it */
    }
    const journeyId = pickJourneyId(product.id, mine.data);
    onAttach({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      image: product.heroImageUrl ?? undefined,
      journeyId,
      verificationState,
    });
    close();
  }

  async function showMe() {
    setBusy(true);
    setScanError("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setScanError("Camera access is off. Enable it in settings, or use Find it instead.");
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (shot.canceled || !shot.assets[0]) return;
      const asset = shot.assets[0];
      const vision = await extractProductFromPhoto({
        uri: asset.uri,
        base64: asset.base64 ?? null,
        mimeType: asset.mimeType ?? "image/jpeg",
        width: asset.width,
        height: asset.height,
      });
      const label = vision.ok ? vision.label : "";
      if (!label) {
        setScanError("Couldn't read the label. Try Find it or search by exact name.");
        setMode("find");
        return;
      }
      setSearch(label);
      setMode("find");
      setVerifyPending(true);
      const results = await searchCommunityProducts(label);
      if (results[0]) setPicked(results[0]);
    } catch {
      setScanError("Photo identification didn't work. Try Find it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionSheet
      open={open}
      title={mode === "find" ? "Find it" : mode === "mine" ? "From my products" : "Add a Product"}
      onClose={close}
    >
      {mode === "home" ? (
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted, marginBottom: 16 }}>
            Quickly add what you&apos;re using in this Unmask.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Show me", sub: "Take a photo of the product", Icon: Camera, go: () => void showMe() },
              { label: "Find it", sub: "Search by name or brand", Icon: MagnifyingGlass, go: () => setMode("find") },
              { label: "From my products", sub: "Pick from what you already use", Icon: Package, go: () => setMode("mine") },
            ].map(({ label, sub, Icon, go }) => (
              <Pressable
                key={label}
                onPress={() => {
                  hapticSelect();
                  go();
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: momentFlow.pillPink,
                  gap: 8,
                  minHeight: 120,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: momentFlow.card, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={22} color={momentFlow.accent} />
                </View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.ink }}>{label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: momentFlow.muted }}>{sub}</Text>
              </Pressable>
            ))}
          </View>
          {busy ? <ActivityIndicator color={momentFlow.accent} style={{ marginBottom: 12 }} /> : null}
          {scanError ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.warnInk, marginBottom: 12 }}>{scanError}</Text>
          ) : null}
          {attached.length ? (
            <View style={{ gap: 8, marginBottom: 12 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.ink }}>In this Unmask</Text>
              {attached.map((p) => (
                <View key={p.productId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={{ width: 40, height: 40, borderRadius: 10 }} accessibilityIgnoresInvertColors />
                  ) : null}
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: momentFlow.ink }}>{p.name}</Text>
                  <SealCheck size={18} color={momentFlow.accent} weight="fill" />
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {mode === "find" ? (
        <View style={{ gap: 12, maxHeight: 420 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search by name or brand" />
          {matches.isFetching || popular.isFetching ? <ActivityIndicator color={momentFlow.accent} /> : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            {(search.trim().length > 1 ? matches.data : popular.data)?.map((row) => {
              const on = picked?.id === row.id;
              const dup = already(row.id);
              return (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    if (dup) return;
                    hapticSelect();
                    setPicked(row);
                    setVerifyPending(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    opacity: dup ? 0.45 : 1,
                    borderBottomWidth: 1,
                    borderBottomColor: momentFlow.accentSoft,
                  }}
                >
                  {row.heroImageUrl ? (
                    <Image source={{ uri: row.heroImageUrl }} style={{ width: 48, height: 48, borderRadius: 12 }} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: momentFlow.pillPink }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>{row.name}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>
                      {[row.brand, row.category].filter(Boolean).join(" • ")}
                    </Text>
                  </View>
                  {dup ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: momentFlow.muted }}>Added</Text>
                  ) : on ? (
                    <SealCheck size={22} color={momentFlow.accent} weight="fill" />
                  ) : null}
                </Pressable>
              );
            })}
            {search.trim().length > 1 && !matches.isFetching && (matches.data?.length ?? 0) === 0 ? (
              <View style={{ paddingVertical: 16, gap: 10 }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted }}>No products matched that search.</Text>
                <Pressable
                  onPress={() => router.push({ pathname: "/investigation/request", params: { q: search } } as Href)}
                  style={{ paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.accent }}>Can&apos;t find it? Request it</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
          <Pressable onPress={() => setMode("home")} style={{ paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: momentFlow.muted, textAlign: "center" }}>← Back</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === "mine" ? (
        <View style={{ gap: 8, maxHeight: 400 }}>
          {mine.isLoading ? <ActivityIndicator color={momentFlow.accent} /> : null}
          <ScrollView>
            {(mine.data ?? []).map((row) => {
              const name = row.unmask_catalog?.name || "Your product";
              const image = row.unmask_catalog?.image_url;
              const dup = already(row.product_id);
              return (
                <Pressable
                  key={row.id}
                  disabled={dup}
                  onPress={() => {
                    hapticSelect();
                    void attachFromCatalog(
                      {
                        id: row.product_id,
                        name,
                        brand: row.unmask_catalog?.brand || "",
                        category: row.unmask_catalog?.category || "",
                        heroImageUrl: image,
                      },
                      "confirmed",
                    );
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    opacity: dup ? 0.45 : 1,
                    borderBottomWidth: 1,
                    borderBottomColor: momentFlow.accentSoft,
                  }}
                >
                  {image ? (
                    <Image source={{ uri: image }} style={{ width: 48, height: 48, borderRadius: 12 }} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: momentFlow.pillPink, alignItems: "center", justifyContent: "center" }}>
                      <Package size={22} color={momentFlow.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>{name}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{row.frequency || row.status || "Your timeline"}</Text>
                  </View>
                </Pressable>
              );
            })}
            {!mine.isLoading && !(mine.data ?? []).length ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted, paddingVertical: 12 }}>
                No products on your shelf yet. Use Find it to attach one.
              </Text>
            ) : null}
          </ScrollView>
          <Pressable onPress={() => setMode("home")} style={{ paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: momentFlow.muted, textAlign: "center" }}>← Back</Text>
          </Pressable>
        </View>
      ) : null}

      {picked && mode === "find" ? (
        <Pressable
          onPress={() => hapticSelect()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            marginTop: 8,
            borderRadius: 16,
            backgroundColor: momentFlow.card,
            borderWidth: 1,
            borderColor: momentFlow.accent,
          }}
        >
          {picked.heroImageUrl ? (
            <Image source={{ uri: picked.heroImageUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} accessibilityIgnoresInvertColors />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>{picked.name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>
              {[picked.brand, picked.category].filter(Boolean).join(" • ")}
            </Text>
          </View>
          <SealCheck size={22} color={momentFlow.accent} weight="fill" />
        </Pressable>
      ) : null}

      {(verifyPending || (picked && mode === "find")) && (
        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: momentFlow.warn, flexDirection: "row", gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: momentFlow.warnInk }}>i</Text>
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: momentFlow.warnInk }}>
            Verification not confirmed yet. You can confirm by taking a clear photo of the product later.
          </Text>
        </View>
      )}

      {picked && mode === "find" ? (
        <Pressable
          onPress={() => {
            hapticSelect();
            void attachFromCatalog(picked, verifyPending ? "pending" : "confirmed");
          }}
          style={{ marginTop: 18, paddingVertical: 16, borderRadius: momentFlow.radiusPill, backgroundColor: momentFlow.accent, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Add to my Unmask</Text>
        </Pressable>
      ) : null}
    </ActionSheet>
  );
}