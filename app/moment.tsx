import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter, type Href } from "expo-router";

import { Camera } from "@/components/icons";
import { ActionButton, AppShell, MediaFrame } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSaved, hapticSelect } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { durablePhoto } from "@/lib/tracking/photos";
import { useAppStore } from "@/lib/store";

const PROMPTS = [
  "You don’t take pictures. One mirror shot is enough.",
  "Show the routine. The timeline can wait.",
  "Beard, hair, skin — if you use it, it belongs here.",
];

export default function Moment() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const display = useAppStore((s) => s.profile?.displayName) || "You";
  const add = useLocalMoments((s) => s.add);
  const [photo, setPhoto] = useState("");
  const [caption, setCaption] = useState("");
  const [product, setProduct] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  async function pick(source: "camera" | "library") {
    setError("");
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("Camera is off. Use your gallery — still counts.");
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto(
        asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : await durablePhoto(asset.uri),
      );
      hapticSelect();
    } catch {
      setError("Couldn’t open that. Try the other button.");
    }
  }

  function post() {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/moment" } } as Href);
      return;
    }
    if (!photo && caption.trim().length < 2) {
      setError("A photo or one honest line. That’s the whole post.");
      return;
    }
    add({
      photo,
      caption: caption.trim() || "Showing my Unmask.",
      author: display,
      productName: product.trim() || undefined,
    });
    hapticSaved("moment");
    setLive(true);
  }

  if (live) {
    return (
      <AppShell back title="It’s up" ambient="socialNight">
        <View style={{ gap: 16, paddingTop: 12 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: "rgba(255,248,244,0.8)" }}>
            Your moment is in the room. A product timeline is optional — add one only if you want the story to keep going.
          </Text>
          <ActionButton label="See it in the feed" onPress={() => router.replace("/" as Href)} />
          <ActionButton tone="secondary" label="Attach a timeline" onPress={() => router.push("/products/add" as Href)} />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell back title="Your moment" subtitle={prompt} ambient="socialNight">
      <View style={{ gap: 14 }}>
        {photo ? (
          <MediaFrame uri={photo} label="Your moment" ratio={4 / 5} corners={false} />
        ) : (
          <Pressable
            onPress={() => void pick("camera")}
            style={{
              minHeight: 360,
              borderRadius: livelyRadii.hero,
              backgroundColor: "#120810",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Camera size={36} color="#F0CF69" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: "#FFF8F4" }}>Tap to open the camera</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: "rgba(255,248,244,0.65)" }}>Or pick from your gallery below</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={() => void pick("camera")} style={pill}><Text style={pillText}>Camera</Text></Pressable>
          <Pressable onPress={() => void pick("library")} style={pill}><Text style={pillText}>Gallery</Text></Pressable>
        </View>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Say it like a story, not a review…"
          placeholderTextColor="rgba(255,248,244,0.45)"
          multiline
          maxLength={180}
          style={{
            minHeight: 88,
            color: "#FFF8F4",
            fontFamily: fonts.regular,
            fontSize: 17,
            lineHeight: 24,
          }}
        />
        <TextInput
          value={product}
          onChangeText={setProduct}
          placeholder="Product name (skip if you just want to show you)"
          placeholderTextColor="rgba(255,248,244,0.45)"
          style={{ color: "#FFF8F4", fontFamily: fonts.regular, fontSize: 15, minHeight: 44 }}
        />
        {error ? <Text style={{ color: "#F0CF69", fontFamily: fonts.medium }}>{error}</Text> : null}
        <ActionButton label="Post it" onPress={post} />
      </View>
    </AppShell>
  );
}

const pill = {
  flex: 1,
  minHeight: 48,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(255,248,244,0.2)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const pillText = { fontFamily: fonts.semibold, color: "#FFF8F4", fontSize: 15 };
