import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { Camera, ImageSquare } from "@/components/icons";
import { useMovementPalette } from "@/components/movement/palette";
import { ActionButton, AppShell, StatusMessage } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect, hapticSuccess } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { publishMoment, publishPost } from "@/lib/social/api";
import { useAppStore } from "@/lib/store";

type Media = { uri: string; kind: "photo" | "video" };

export function Compose({ kind }: { kind: "story" | "post" }) {
  const palette = useMovementPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((state) => state.profile?.id);
  const [media, setMedia] = useState<Media | null>(null);
  const [caption, setCaption] = useState("");
  const [card, setCard] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState("");
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journeyLabel, setJourneyLabel] = useState("");
  const [picking, setPicking] = useState<"product" | "timeline" | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const catalog = useQuery({
    queryKey: ["catalog", "compose"],
    queryFn: () => living.catalog(),
    enabled: picking === "product",
  });
  const journeys = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: living.journeys,
    enabled: picking === "timeline" && !!uid,
  });
  const story = kind === "story";
  const pick = async (camera: boolean) => {
    setError("");
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(camera ? "Allow the camera to take a photo." : "Allow photo access to choose a photo.");
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: camera ? ["images"] : ["images", "videos"],
        quality: 0.85,
        videoMaxDuration: 30,
      };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      const video = asset.type === "video";
      const duration = asset.duration ?? 0;
      if (video && duration > 0 && (duration > 30000 || (duration < 1000 && duration > 30))) {
        throw new Error("Keep the video under 30 seconds.");
      }
      setMedia({ uri: asset.uri, kind: video ? "video" : "photo" });
      setPicking(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open that photo.");
    }
  };
  const publish = async () => {
    if (!media) {
      setError("Add a photo first.");
      return;
    }
    if (!uid) {
      router.push({ pathname: "/sign-up", params: { returnTo: story ? "/moment/new" : "/post/new" } } as Href);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (story) {
        const attach = card
          ? { kind: "card" as const, id: uid, label: "My Unmask" }
          : journeyId
            ? { kind: "timeline" as const, id: journeyId, label: journeyLabel || "Timeline" }
            : productId
              ? { kind: "product" as const, id: productId, label: productLabel || "What I'm using" }
              : null;
        await publishMoment({ uri: media.uri, kind: media.kind, caption, attach });
      } else {
        await publishPost({
          uri: media.uri,
          kind: media.kind,
          caption,
          productId,
          journeyId,
          attachCard: card,
          label: journeyLabel || productLabel || (card ? "My Unmask" : null),
        });
      }
      hapticSuccess();
      await qc.invalidateQueries({ queryKey: [story ? "social-moments" : "social-posts"] });
      router.replace(story ? "/" : "/community");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not share that.");
    } finally {
      setBusy(false);
    }
  };
  const products = (catalog.data ?? []).filter((item) => `${item.name} ${item.brand ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  return (
    <AppShell back title={story ? "Your story" : "New post"} subtitle={story ? "A photo first. It leaves in a day." : "A photo first. Add depth after, if you want."}>
      <View style={{ gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={media ? "Change photo" : "Add a photo or short video"}
          onPress={() => void pick(false)}
          style={{ borderRadius: 28, overflow: "hidden", backgroundColor: palette.quiet, minHeight: media ? undefined : 360, aspectRatio: media ? 4 / 5 : undefined, alignItems: "center", justifyContent: "center" }}
        >
          {media && media.kind === "photo" ? (
            <Image source={{ uri: media.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
          ) : media ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: palette.ink }}>Video ready</Text>
          ) : (
            <View style={{ alignItems: "center", gap: 10, padding: 24 }}>
              <Camera size={36} color={palette.wine} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, color: palette.ink, textAlign: "center" }}>
                Add a photo or short video
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: palette.muted, textAlign: "center" }}>
                {story ? "This is me right now." : "This can stand on its own."}
              </Text>
            </View>
          )}
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose a photo" onPress={() => void pick(false)} style={choice(palette)}>
            <ImageSquare size={18} color={palette.wine} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>Choose a photo</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" onPress={() => void pick(true)} style={choice(palette)}>
            <Camera size={18} color={palette.wine} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>Take a photo</Text>
          </Pressable>
        </View>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={story ? "Say it in a line, if you want" : "Write a caption, if you want"}
          placeholderTextColor={palette.muted}
          multiline
          maxLength={story ? 180 : 500}
          style={{ minHeight: 72, borderRadius: 18, padding: 14, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, fontFamily: fonts.regular, fontSize: 16, color: palette.ink }}
        />
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.8, color: palette.gold }}>AFTER THE PHOTO</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted }}>
            Optional. Attach your Unmask, a product, or a timeline when it feels natural.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label={card ? "My Unmask added" : "Attach My Unmask"} selected={card} onPress={() => { hapticSelect(); setCard((on) => !on); }} />
            <Chip label={productLabel || "Tag a product"} selected={!!productId} onPress={() => { hapticSelect(); setPicking((current) => current === "product" ? null : "product"); }} />
            <Chip label={journeyLabel || "Point to a timeline"} selected={!!journeyId} onPress={() => { hapticSelect(); setPicking((current) => current === "timeline" ? null : "timeline"); }} />
          </View>
        </View>
        {picking === "product" ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a product"
              placeholderTextColor={palette.muted}
              style={{ minHeight: 48, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.line, color: palette.ink, fontFamily: fonts.regular }}
            />
            {catalog.isError ? <StatusMessage kind="error" title="Product search couldn’t load." /> : null}
            {products.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => {
                  setProductId(item.id);
                  setProductLabel(item.name);
                  setPicking(null);
                }}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: palette.ink }}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {picking === "timeline" ? (
          <View style={{ gap: 8 }}>
            {!uid ? <Text style={{ fontFamily: fonts.regular, color: palette.muted }}>Get Started to attach a timeline you keep.</Text> : null}
            {(journeys.data ?? []).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => {
                  setJourneyId(item.id);
                  setJourneyLabel(item.unmask_catalog?.name || "Timeline");
                  setPicking(null);
                }}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: palette.ink }}>{item.unmask_catalog?.name || "Timeline"}</Text>
              </Pressable>
            ))}
            {journeys.isSuccess && !journeys.data?.length ? (
              <Pressable accessibilityRole="link" onPress={() => router.push("/products/add" as Href)}>
                <Text style={{ fontFamily: fonts.semibold, color: palette.wine }}>Start a timeline</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {error ? <StatusMessage kind="error" title={error} /> : null}
        <ActionButton
          label={busy ? "Sharing…" : !uid ? "Get Started to share" : story ? "Add to your story" : "Post"}
          disabled={busy || !media}
          onPress={() => void publish()}
        />
      </View>
    </AppShell>
  );
}

function choice(palette: ReturnType<typeof useMovementPalette>) {
  return {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
  };
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const palette = useMovementPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: selected ? palette.button : palette.card, borderWidth: 1, borderColor: selected ? palette.button : palette.line }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: selected ? palette.buttonText : palette.ink }}>{label}</Text>
    </Pressable>
  );
}
