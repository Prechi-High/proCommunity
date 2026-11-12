import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { Clock } from "@/components/icons";
import { UnmaskCamera } from "@/components/social/UnmaskCamera";
import { ActionButton, ActionSheet, AppShell, MediaFrame } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSaved, hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { useRoomTone } from "@/lib/social/roomTone";
import { durablePhoto } from "@/lib/tracking/photos";
import { useAppStore } from "@/lib/store";

const LOOKS = [
  { id: "clear", label: "Clear", tint: "transparent" },
  { id: "glow", label: "Glow", tint: "rgba(255, 186, 140, 0.34)" },
  { id: "rose", label: "Rose", tint: "rgba(176, 64, 96, 0.28)" },
  { id: "warm", label: "Warm", tint: "rgba(201, 162, 39, 0.3)" },
  { id: "cool", label: "Cool", tint: "rgba(90, 140, 210, 0.28)" },
] as const;

const SKINS = ["Skip", "Dry", "Oily", "Combination", "Sensitive", "Normal"] as const;
const EXAMPLES = [
  { id: "sample-tl-dew", name: "Dew Days Daily Cream", when: "Week 2" },
  { id: "sample-tl-spf", name: "Sunroom Daily SPF", when: "Daily" },
];

export default function Moment() {
  const router = useRouter();
  const tone = useRoomTone();
  const uid = useAppStore((s) => s.profile?.id);
  const display = useAppStore((s) => s.profile?.displayName) || "You";
  const add = useLocalMoments((s) => s.add);
  const journeys = useQuery({
    queryKey: ["living", "journeys", uid, "pin"],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const [photo, setPhoto] = useState("");
  const [caption, setCaption] = useState("");
  const [look, setLook] = useState<(typeof LOOKS)[number]["id"]>("glow");
  const [destination, setDestination] = useState<"post" | "story" | "both">("both");
  const [skin, setSkin] = useState<(typeof SKINS)[number]>("Skip");
  const [timelineId, setTimelineId] = useState("");
  const [timelineLabel, setTimelineLabel] = useState("");
  const [picker, setPicker] = useState(false);
  const [stickers, setStickers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const tint = LOOKS.find((item) => item.id === look)?.tint ?? "transparent";

  const real = (journeys.data ?? []).map((row) => ({
    id: row.id,
    name: row.unmask_catalog?.name || "Your product",
    when: row.frequency || row.status || "Timeline",
    sample: false,
  }));
  const choices = real.length ? real : EXAMPLES.map((row) => ({ ...row, sample: true }));

  async function pick(source: "camera" | "library") {
    setError("");
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("Camera is off. Upload from your gallery — that still counts.");
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.7, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.7, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.type === "video") {
        setPhoto(asset.uri);
      } else {
        setPhoto(
          asset.base64
            ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
            : await durablePhoto(asset.uri),
        );
      }
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
      setError("A photo, a clip, or one honest line.");
      return;
    }
    add({
      photo,
      caption: caption.trim() || "Showing my Unmask.",
      author: display,
      skin: skin === "Skip" ? undefined : skin,
      timelineId: timelineId || undefined,
      timelineLabel: timelineLabel || undefined,
      destination,
      stickers,
    });
    hapticSaved("moment");
    setLive(true);
  }

  if (live) {
    return (
      <AppShell back title="It’s in the room" ambient="socialNight">
        <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: tone.muted }}>
          {destination === "story"
            ? "It’s on your story ring."
            : destination === "both"
              ? "It’s a post, and it’s on your story."
              : "It’s a post. Your story ring stays as it was."}
        </Text>
        <ActionButton label="See the room" onPress={() => router.replace("/" as Href)} />
      </AppShell>
    );
  }

  const timelineSheet = (
    <ActionSheet open={picker} title="Pin a timeline" onClose={() => setPicker(false)}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: tone.muted }}>
        {real.length ? "Your timelines." : "Example timelines, so you can see the pin. Yours show up here once you have one."}
      </Text>
      {choices.map((row) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          onPress={() => {
            hapticSelect();
            setTimelineId(row.id);
            setTimelineLabel(`${row.name} · ${row.when}`);
            setPicker(false);
          }}
          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tone.line }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: tone.text }}>{row.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: tone.muted }}>{row.when}{row.sample ? " · example" : ""}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => { setTimelineId(""); setTimelineLabel(""); setPicker(false); }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: tone.muted }}>Post without a timeline</Text>
      </Pressable>
    </ActionSheet>
  );

  if (!photo || cameraOn) {
    return (
      <View style={{ flex: 1 }}>
        <UnmaskCamera
          onClose={() => (photo ? setCameraOn(false) : router.back())}
          onTimeline={() => setPicker(true)}
          onShot={(uri, pinned) => {
            setPhoto(uri);
            setStickers(pinned);
            setCameraOn(false);
          }}
        />
        {timelineSheet}
      </View>
    );
  }

  return (
    <AppShell back title="Create" subtitle="Glow, film, then choose post, story, or both." ambient="socialNight">
      <View style={{ gap: 14 }}>
        <View style={{ borderRadius: livelyRadii.hero, overflow: "hidden", minHeight: 380, backgroundColor: "#120810" }}>
          {photo ? (
            <View>
              <MediaFrame uri={photo} label="Your moment" ratio={4 / 5} corners={false} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: tint }} />
            </View>
          ) : null}
          {stickers.map((label) => (
            <View key={label} pointerEvents="none" style={{ position: "absolute", left: 16, bottom: 16 + stickers.indexOf(label) * 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(18,8,16,0.55)" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {LOOKS.map((item) => (
            <Pressable key={item.id} onPress={() => setLook(item.id)} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item.tint === "transparent" ? "#2A2422" : item.tint, borderWidth: look === item.id ? 2 : 0, borderColor: "#F0CF69" }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: look === item.id ? tone.gold : tone.muted }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={() => setCameraOn(true)} style={pill}><Text style={pillText}>Retake</Text></Pressable>
          <Pressable onPress={() => void pick("library")} style={pill}><Text style={pillText}>Upload</Text></Pressable>
        </View>

        <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, color: tone.gold }}>WHERE IT GOES</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["post", "story", "both"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setDestination(item)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: destination === item ? "#3D0F15" : "transparent",
                borderWidth: 1,
                borderColor: tone.line,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: destination === item ? "#FFF8F4" : tone.text }}>
                {item === "post" ? "Post" : item === "story" ? "Story" : "Both"}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="A line, like a story. Not a review."
          placeholderTextColor={tone.faint}
          multiline
          maxLength={180}
          style={{ minHeight: 72, color: tone.text, fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 }}
        />

        <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, color: tone.gold }}>SKIN · OPTIONAL</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SKINS.map((item) => (
            <Pressable key={item} onPress={() => setSkin(item)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: skin === item ? tone.gold : tone.line }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: skin === item ? tone.gold : tone.text }}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setPicker(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: tone.line }}
        >
          <Clock size={20} color={tone.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone.text }}>
              {timelineLabel || "Pin a product timeline"}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: tone.muted }}>Choose one you already have. Nothing new to fill in.</Text>
          </View>
        </Pressable>

        {error ? <Text style={{ color: tone.gold, fontFamily: fonts.medium }}>{error}</Text> : null}
        <ActionButton label={destination === "story" ? "Add to story" : destination === "both" ? "Post and add to story" : "Post it"} onPress={post} />
      </View>

      {timelineSheet}
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
