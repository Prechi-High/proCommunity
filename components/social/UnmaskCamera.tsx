import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { CameraRotate, HandHeart, ImageSquare, Lightning, MoonStars, SmileyNervous, Sparkle, Sun, TrendUp, X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

const LOOKS = [
  { id: "clear", label: "Natural", tint: "transparent", swatch: "#2A2422" },
  { id: "glow", label: "Glow", tint: "rgba(255, 186, 140, 0.28)", swatch: "#FFB88C" },
  { id: "rose", label: "Bloom", tint: "rgba(176, 64, 96, 0.24)", swatch: "#E87EC8" },
  { id: "warm", label: "Warm", tint: "rgba(201, 162, 39, 0.26)", swatch: "#F0CF69" },
  { id: "cool", label: "Cool", tint: "rgba(90, 140, 210, 0.22)", swatch: "#8BB4E8" },
] as const;

const ROUTINES = [
  { id: "unmask", label: "My Unmask", sticker: "My Unmask", Icon: Sparkle, accent: true },
  { id: "morning", label: "Morning routine", sticker: "Morning routine", Icon: Sun },
  { id: "evening", label: "Evening routine", sticker: "Evening routine", Icon: MoonStars },
  { id: "grwm", label: "GRWM", sticker: "GRWM", Icon: HandHeart },
  { id: "timeline", label: "Product timeline", sticker: "Product timeline", Icon: TrendUp, timeline: true },
  { id: "just", label: "Just me", sticker: "Just me", Icon: SmileyNervous },
] as const;

export function UnmaskCamera({
  onClose,
  onShot,
  onTimeline,
}: {
  onClose: () => void;
  onShot: (photo: string, stickers: string[], kind?: "photo" | "video") => void;
  onTimeline: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const shotRef = useRef(onShot);
  shotRef.current = onShot;
  const [permission, requestPermission] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [recordingUi, setRecordingUi] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recording = useRef(false);
  const held = useRef(false);
  const webStop = useRef<(() => Promise<string>) | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [grid, setGrid] = useState(false);
  const [look, setLook] = useState(0);
  const [routine, setRoutine] = useState(0);
  const [captureMode, setCaptureMode] = useState<"photo" | "video">("photo");
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const tint = LOOKS[look]?.tint ?? "transparent";
  const activeRoutine = ROUTINES[routine] ?? ROUTINES[0];
  const stickers = [activeRoutine.sticker];

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

  async function beginWebClip() {
    if (typeof document === "undefined") return null;
    const video = document.querySelector("video") as (HTMLVideoElement & { captureStream?: () => MediaStream }) | null;
    const base = video?.captureStream?.();
    if (!base) return null;
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      audio.getAudioTracks().forEach((track) => base.addTrack(track));
    } catch {
      /* a silent clip is still a clip */
    }
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
    );
    const rec = new MediaRecorder(base, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const done = new Promise<string>((resolve, reject) => {
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
        if (!blob.size) reject(new Error("empty"));
        else resolve(URL.createObjectURL(blob));
      };
      rec.onerror = () => reject(new Error("record"));
    });
    rec.start();
    return {
      stop: () => {
        if (rec.state !== "inactive") rec.stop();
        base.getAudioTracks().forEach((track) => track.stop());
        return done;
      },
    };
  }

  async function startRecord() {
    if (!ready) return;
    recording.current = true;
    setRecordingUi(true);
    setError("");
    if (Platform.OS === "web") {
      const clip = await beginWebClip();
      if (!clip) {
        recording.current = false;
        setRecordingUi(false);
        held.current = false;
        setError("Hold to record isn’t available in this browser. A tap still takes a photo.");
        return;
      }
      webStop.current = clip.stop;
      return;
    }
    if (!mic?.granted) {
      const next = await requestMic();
      if (!next.granted) {
        recording.current = false;
        setRecordingUi(false);
        held.current = false;
        setError("Video needs the microphone. A tap still takes a photo.");
        return;
      }
    }
    try {
      const clip = await camera.current?.recordAsync({ maxDuration: 15 });
      if (clip?.uri) onShot(clip.uri, stickers, "video");
    } catch {
      setError("Couldn’t record that. A tap still takes a photo.");
    } finally {
      recording.current = false;
      setRecordingUi(false);
    }
  }

  function pressIn() {
    if (captureMode !== "video") return;
    held.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      held.current = true;
      void startRecord();
    }, 280);
  }

  function pressOut() {
    if (captureMode !== "video") return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (webStop.current) {
      const stop = webStop.current;
      webStop.current = null;
      void stop()
        .then((uri) => onShot(uri, stickers, "video"))
        .catch(() => setError("That clip didn’t save. Hold the shutter and try again."));
      recording.current = false;
      setRecordingUi(false);
      return;
    }
    if (recording.current && Platform.OS !== "web") void camera.current?.stopRecording();
  }

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

  async function onShutter() {
    if (captureMode === "video") {
      if (!held.current) setError("Hold the shutter to record video.");
      return;
    }
    await shoot();
  }

  async function upload() {
    setError("");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` : asset.uri;
    onShot(uri, stickers);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {permission?.granted ? (
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing={facing}
          mode={Platform.OS === "web" ? "picture" : captureMode === "video" ? "video" : "picture"}
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
          <Pressable onPress={() => void requestPermission()} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#FF6B9D" }}>
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

      <View pointerEvents="none" style={{ position: "absolute", top: "38%", left: 0, right: 0, alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 36, color: "#FF8BC8", textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 8 }}>
          {activeRoutine.label}
        </Text>
        <View style={{ marginTop: 4 }}>
          <Sparkle size={22} color="#FF6B9D" weight="fill" />
        </View>
      </View>

      {count !== null && count > 0 ? (
        <View pointerEvents="none" style={{ position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 72, color: "#FFF8F4" }}>{count}</Text>
        </View>
      ) : null}

      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8 }}>
          <Pressable accessibilityLabel="Close camera" onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <X size={24} color="#FFF8F4" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 17, color: "#FFF8F4" }}>Create Your Unmask</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable accessibilityLabel="Flash" onPress={() => setTorch((v) => !v)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Lightning size={22} color={torch ? "#FF8BC8" : "#FFF8F4"} weight={torch ? "fill" : "regular"} />
            </Pressable>
            <Pressable accessibilityLabel="Flip camera" onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <CameraRotate size={22} color="#FFF8F4" />
            </Pressable>
          </View>
        </View>

        <View style={{ position: "absolute", left: 8, top: 110, gap: 8, maxWidth: 148 }}>
          {ROUTINES.map((row, index) => {
            const active = routine === index;
            const Icon = row.Icon;
            const onPick = () => {
              hapticSelect();
              setRoutine(index);
              if ("timeline" in row && row.timeline) onTimeline();
            };
            if (active && row.id === "unmask") {
              return (
                <Pressable key={row.id} accessibilityRole="button" onPress={onPick}>
                  <LinearGradient colors={["#FF6B9D", "#C94B8A"]} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon size={16} color="#1A0A14" weight="fill" />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#1A0A14" }}>{row.label}</Text>
                  </LinearGradient>
                </Pressable>
              );
            }
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPress={onPick}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? "rgba(255,107,157,0.35)" : "rgba(0,0,0,0.45)",
                  borderWidth: active ? 1 : 0,
                  borderColor: "rgba(255,139,200,0.6)",
                }}
              >
                <Icon size={16} color="#FFF8F4" weight={active ? "fill" : "regular"} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#FFF8F4" }} numberOfLines={1}>
                  {row.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ position: "absolute", right: 10, top: 110, gap: 10, alignItems: "center" }}>
          {LOOKS.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                hapticSelect();
                setLook(index);
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: look === index ? 3 : 1,
                borderColor: look === index ? "#FF8BC8" : "rgba(255,255,255,0.35)",
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: item.swatch,
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: "#FFF8F4", textAlign: "center" }}>{item.label.slice(0, 3)}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityLabel="Grid guide" onPress={() => setGrid((v) => !v)} style={{ marginTop: 6 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: grid ? "#FF8BC8" : "rgba(255,248,244,0.6)" }}>Grid</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: "auto", paddingBottom: 8, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityLabel="Upload from gallery" onPress={() => void upload()} style={{ width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,248,244,0.35)", alignItems: "center", justifyContent: "center" }}>
            <ImageSquare size={26} color="#FFF8F4" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={captureMode === "photo" ? "Take a photo" : "Hold for video"}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={() => void onShutter()}
            style={{
              width: 82,
              height: 82,
              borderRadius: 41,
              borderWidth: 5,
              borderColor: recordingUi ? "#E23B3B" : "#FF6B9D",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: recordingUi ? 36 : 66,
                height: recordingUi ? 36 : 66,
                borderRadius: recordingUi ? 8 : 33,
                backgroundColor: recordingUi ? "#E23B3B" : "#FF6B9D",
              }}
            />
          </Pressable>
          <Pressable accessibilityLabel="Flip camera" onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <CameraRotate size={28} color="#FFF8F4" />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignSelf: "center",
            marginBottom: 12,
            padding: 4,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.45)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          {(["photo", "video"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              onPress={() => {
                hapticSelect();
                setCaptureMode(mode);
              }}
              style={{
                paddingHorizontal: 22,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: captureMode === mode ? "#FF6B9D" : "transparent",
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: captureMode === mode ? "#1A0A14" : "#FFF8F4" }}>
                {mode === "photo" ? "Photo" : "Video"}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={{ color: "#FF8BC8", textAlign: "center", fontFamily: fonts.medium, paddingBottom: 4 }}>{error}</Text> : null}
        <Text style={{ textAlign: "center", fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,248,244,0.55)", paddingBottom: 8 }}>
          {recordingUi ? "Recording · let go to stop" : captureMode === "photo" ? `${LOOKS[look]?.label} · tap to capture` : "Hold the shutter to record"}
        </Text>
      </SafeAreaView>
    </View>
  );
}
