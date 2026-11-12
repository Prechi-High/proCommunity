import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { Lightning, X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

const LOOKS = [
  { id: "clear", label: "Clear", tint: "transparent" },
  { id: "glow", label: "Glow", tint: "rgba(255, 186, 140, 0.28)" },
  { id: "rose", label: "Rose", tint: "rgba(176, 64, 96, 0.24)" },
  { id: "warm", label: "Warm", tint: "rgba(201, 162, 39, 0.26)" },
] as const;

const STICKERS = ["This is me", "Good for who?", "My Unmask", "Skin · mine", "Week 2", "No verdict"];

export function UnmaskCamera({
  onClose,
  onShot,
  onTimeline,
}: {
  onClose: () => void;
  onShot: (photo: string, stickers: string[]) => void;
  onTimeline: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const shotRef = useRef(onShot);
  shotRef.current = onShot;
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [grid, setGrid] = useState(false);
  const [look, setLook] = useState(0);
  const [stickers, setStickers] = useState<string[]>([]);
  const [tray, setTray] = useState<"stickers" | "sounds" | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const tint = LOOKS[look]?.tint ?? "transparent";

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (count === null || count === 0) return;
    const t = setTimeout(() => {
      setCount((n) => {
        if (n === null) return null;
        if (n <= 1) {
          void camera.current?.takePictureAsync({ quality: 0.75, base64: true }).then((photo) => {
            if (!photo) return;
            const uri = photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
            shotRef.current(uri, stickers);
          }).catch(() => setError("The Unmask camera couldn’t take that. Try again."));
          return null;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [count, stickers]);

  async function shoot() {
    if (!ready) return;
    setError("");
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.75, base64: true });
      if (!photo) return;
      const uri = photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
      onShot(uri, stickers);
    } catch {
      setError("The Unmask camera couldn’t take that. Try again.");
    }
  }

  async function upload() {
    setError("");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` : asset.uri;
    onShot(uri, stickers);
  }

  const tool = (label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ alignItems: "center", gap: 2, minWidth: 54 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: "#FFF8F4" }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {permission?.granted ? (
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing={facing}
          mode="picture"
          enableTorch={torch && facing === "back"}
          mirror={facing === "front"}
          onCameraReady={() => setReady(true)}
          onMountError={() => setError("Unmask camera couldn’t start on this device.")}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: "#FFF8F4", textAlign: "center" }}>Unmask needs the camera</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,248,244,0.7)", textAlign: "center" }}>
            This stays inside Unmask. It will not open your phone’s camera app.
          </Text>
          <Pressable onPress={() => void requestPermission()} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#F0CF69" }}>
            <Text style={{ fontFamily: fonts.semibold, color: "#1A0A14" }}>Allow camera</Text>
          </Pressable>
        </View>
      )}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: tint }} />
      {grid ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <View style={{ position: "absolute", left: "33%", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.35)" }} />
          <View style={{ position: "absolute", left: "66%", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.35)" }} />
          <View style={{ position: "absolute", top: "33%", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.35)" }} />
          <View style={{ position: "absolute", top: "66%", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.35)" }} />
        </View>
      ) : null}
      {stickers.map((label, index) => (
        <View key={`${label}-${index}`} pointerEvents="none" style={{ position: "absolute", top: 120 + index * 36, left: 24, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(18,8,16,0.55)" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>{label}</Text>
        </View>
      ))}
      {count !== null && count > 0 ? (
        <View pointerEvents="none" style={{ position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 72, color: "#FFF8F4" }}>{count}</Text>
        </View>
      ) : null}

      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable accessibilityLabel="Close camera" onPress={onClose} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <X size={22} color="#FFF8F4" />
          </Pressable>
          <Pressable accessibilityLabel="Flash" onPress={() => setTorch((v) => !v)}>
            <Lightning size={22} color={torch ? "#F0CF69" : "#FFF8F4"} weight={torch ? "fill" : "regular"} />
          </Pressable>
        </View>

        <View style={{ position: "absolute", right: 10, top: 110, gap: 16, alignItems: "flex-end" }}>
          {tool("Timeline", () => { hapticSelect(); onTimeline(); })}
          {tool("Sounds", () => setTray(tray === "sounds" ? null : "sounds"))}
          {tool("Look", () => setLook((n) => (n + 1) % LOOKS.length))}
          {tool("Timer", () => setCount(3))}
          {tool("Grid", () => setGrid((v) => !v))}
          {tool("Stickers", () => setTray(tray === "stickers" ? null : "stickers"))}
        </View>

        {tray ? (
          <View style={{ position: "absolute", left: 16, right: 72, bottom: 130, gap: 8 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,248,244,0.7)" }}>
              {tray === "stickers" ? "Tap to pin an Unmask sticker" : "A quiet label. No outside music."}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(tray === "stickers" ? STICKERS : ["Quiet room", "GRWM", "None"]).map((label) => (
                <Pressable
                  key={label}
                  onPress={() => {
                    hapticSelect();
                    if (label !== "None") setStickers((list) => (list.includes(label) ? list : [...list, label]));
                    setTray(null);
                  }}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,248,244,0.25)" }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: "auto", paddingBottom: 18, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityLabel="Upload from gallery" onPress={() => void upload()} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,248,244,0.4)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: "#FFF8F4", textAlign: "center" }}>Roll</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={() => void shoot()}
            style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#FFF8F4", alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#FFF8F4" }} />
          </Pressable>
          <Pressable accessibilityLabel="Flip camera" onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#FFF8F4" }}>Flip</Text>
          </Pressable>
        </View>
        {error ? <Text style={{ color: "#F0CF69", textAlign: "center", fontFamily: fonts.medium, paddingBottom: 8 }}>{error}</Text> : null}
        <Text style={{ textAlign: "center", fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,248,244,0.55)", paddingBottom: 6 }}>{LOOKS[look]?.label} · Unmask camera</Text>
      </SafeAreaView>
    </View>
  );
}
