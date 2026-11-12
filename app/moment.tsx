import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter, type Href } from "expo-router";

import { Camera, Clock, Package } from "@/components/icons";
import { GlassCard } from "@/components/lively";
import { ActionButton, AppShell, MediaFrame, SearchField } from "@/components/unmask-ui";
import { colors, fonts, livelyRadii } from "@/constants/theme";
import { useMomentDraft } from "@/lib/moment/draft";
import { durablePhoto } from "@/lib/tracking/photos";
import { useAppStore } from "@/lib/store";
import { hapticSelect } from "@/lib/haptics";

export default function Moment() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const setDraft = useMomentDraft((s) => s.setDraft);
  const [photo, setPhoto] = useState("");
  const [caption, setCaption] = useState("");
  const [productQ, setProductQ] = useState("");
  const [error, setError] = useState("");

  async function pick(source: "camera" | "library" | "video") {
    setError("");
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("Allow camera access to capture your moment.");
          return;
        }
      }
      const mediaTypes =
        source === "video"
          ? (["videos"] as ImagePicker.MediaType[])
          : (["images"] as ImagePicker.MediaType[]);
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.75, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.75, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
        : await durablePhoto(asset.uri);
      setPhoto(uri);
      hapticSelect();
    } catch {
      setError("Couldn’t open the camera or gallery. Try again.");
    }
  }

  function publish() {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/moment" } } as Href);
      return;
    }
    if (!photo && !caption.trim()) {
      setError("Add a photo, video, or a short caption — or both.");
      return;
    }
    setDraft({
      photo,
      caption: caption.trim(),
      productName: productQ.trim() || undefined,
    });
    const q = productQ.trim();
    router.push({
      pathname: "/contribute",
      params: {
        moment: "1",
        ...(q ? { productName: q } : {}),
      },
    } as Href);
  }

  return (
    <AppShell back title="Share your moment" subtitle="Photo or video first. My Unmask and timelines are optional." ambient="social">
      <View style={{ gap: 18 }}>
        <GlassCard padded={false} style={{ overflow: "hidden", borderRadius: livelyRadii.hero }}>
          {photo ? (
            <MediaFrame uri={photo} label="Your moment" ratio={4 / 5} corners={false} />
          ) : (
            <View
              style={{
                minHeight: 320,
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 24,
                backgroundColor: colors.mist,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, textAlign: "center" }}>
                Show yourself. Show what you use.
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: "center" }}>
                Like a story — quick and real. You can attach a product timeline later.
              </Text>
            </View>
          )}
        </GlassCard>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Camera", onPress: () => void pick("camera"), Icon: Camera },
            { label: "Gallery", onPress: () => void pick("library"), Icon: Package },
            { label: "Video", onPress: () => void pick("video"), Icon: Camera },
          ].map(({ label, onPress, Icon }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={onPress}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 52,
                borderRadius: livelyRadii.button,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: pressed ? colors.stage : colors.white,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              })}
            >
              <Icon size={22} color={colors.brandDeep} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          accessibilityLabel="Caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="What’s happening? GRWM, new product, week 2 update…"
          placeholderTextColor={colors.inkSoft}
          multiline
          maxLength={280}
          style={{
            minHeight: 100,
            padding: 16,
            borderRadius: livelyRadii.button,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white,
            fontFamily: fonts.regular,
            fontSize: 17,
            lineHeight: 24,
            color: colors.ink,
            textAlignVertical: "top",
          }}
        />

        <GlassCard>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Package size={20} color={colors.brandDeep} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Attach product (optional)</Text>
            </View>
            <SearchField
              value={productQ}
              onChange={setProductQ}
              placeholder="Name on the bottle — search next"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/products/add" as Href)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Clock size={18} color={colors.brand} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.brand }}>Or link a product timeline</Text>
            </Pressable>
          </View>
        </GlassCard>

        {error ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.coral }}>{error}</Text>
        ) : null}

        <ActionButton label="Post to community" onPress={publish} />
      </View>
    </AppShell>
  );
}
