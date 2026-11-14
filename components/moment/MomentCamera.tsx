import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { CameraRotate, ImageSquare, Lightning, X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

export function MomentCamera({
  kind,
  onClose,
  onShot,
  onAddRoutine,
}: {
  kind: MomentKind;
  onClose: () => void;
  onShot: (uri: string, mediaKind: "photo" | "video") => void;
  onAddRoutine?: () => void;
}) {
  const config = momentConfig(kind);
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
  const [captureMode, setCaptureMode] = useState<"photo" | "video">(config.defaultMode);
  const [error, setError] = useState("");
  const evening = kind === "evening";
  const cream = kind === "currently" || kind === "morning";

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  async function beginWebClip() {
    if (typeof document === "undefined") return null;
    const video = document.querySelector("video") as (HTMLVideoElement & { captureStream?: () => MediaStream }) | null;
    const base = video?.captureStream?.();
    if (!base) return null;
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      audio.getAudioTracks().forEach((track) => base.addTrack(track));
    } catch {
      /* silent clip */
    }
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
    );
    const rec = new MediaRecorder(base, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
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
        base.getAudioTracks().forEach((t) => t.stop());
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
        setError("Hold to record isn’t available here. Try Photo mode.");
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
        setError("Video needs the microphone.");
        return;
      }
    }
    try {
      const clip = await camera.current?.recordAsync({ maxDuration: 30 });
      if (clip?.uri) onShot(clip.uri, "video");
    } catch {
      setError("Couldn’t record that.");
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
        .then((uri) => onShot(uri, "video"))
        .catch(() => setError("That clip didn’t save."));
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
      const photo = await camera.current?.takePictureAsync({ quality: 0.78, base64: true });
      if (!photo) return;
      const uri = photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
      onShot(uri, "photo");
    } catch {
      setError("Couldn’t take that photo.");
    }
  }

  async function upload() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.75, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` : asset.uri;
    onShot(uri, asset.type === "video" ? "video" : "photo");
  }

  const headerColor = evening ? "#FFF8F4" : cream ? "#2D1B1B" : "#FFF8F4";
  const titleFont = kind === "grwm" ? fonts.serifBold : fonts.semibold;

  return (
    <View style={{ flex: 1, backgroundColor: evening ? "#0A0610" : cream ? "#F9F5EB" : "#1A0A14" }}>
      {permission?.granted ? (
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing={facing}
          mode={Platform.OS === "web" ? "picture" : captureMode === "video" ? "video" : "picture"}
          enableTorch={torch && facing === "back"}
          mirror={facing === "front"}
          onCameraReady={() => setReady(true)}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: headerColor, textAlign: "center" }}>Allow camera to Unmask this moment</Text>
          <Pressable onPress={() => void requestPermission()} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: "#FF6B9D" }}>
            <Text style={{ fontFamily: fonts.semibold, color: "#1A0A14" }}>Allow camera</Text>
          </Pressable>
        </View>
      )}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: config.tint }} />
      {config.scrim ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: config.scrim }} /> : null}

      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 4 }}>
          <Pressable onPress={onClose} accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <X size={24} color={headerColor} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontFamily: titleFont, fontSize: kind === "grwm" ? 28 : 20, color: headerColor }}>
              {config.title} {config.emoji}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: evening ? "rgba(255,248,244,0.75)" : "rgba(45,27,27,0.7)" }}>{config.captureSubtitle}</Text>
          </View>
          <Pressable onPress={() => setTorch((v) => !v)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Lightning size={22} color={torch ? "#FF8BC8" : headerColor} weight={torch ? "fill" : "regular"} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 20, marginTop: 12 }}>
          {config.stickers.map((label) => (
            <View key={label} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: evening ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)" }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: evening ? "#FFF8F4" : "#2D1B1B" }}>{label}</Text>
            </View>
          ))}
        </View>

        {kind === "morning" && onAddRoutine ? (
          <Pressable
            onPress={() => {
              hapticSelect();
              onAddRoutine();
            }}
            style={{ alignSelf: "center", marginTop: "auto", marginBottom: 120, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#3D0F15" }}>Add to my morning routine +</Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: kind === "morning" ? 0 : "auto", paddingBottom: 8, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => void upload()} style={{ width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: evening ? "rgba(255,255,255,0.35)" : "rgba(45,27,27,0.25)", alignItems: "center", justifyContent: "center", backgroundColor: evening ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.65)" }}>
            <ImageSquare size={26} color={headerColor} />
          </Pressable>
          <Pressable
            accessibilityLabel={captureMode === "video" ? "Hold to record" : "Take photo"}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={() => {
              if (captureMode === "photo") void shoot();
            }}
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              borderWidth: 5,
              borderColor: recordingUi ? "#E23B3B" : evening ? "#C9A227" : "#70323E",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: evening ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)",
            }}
          >
            <View style={{ width: recordingUi ? 36 : 66, height: recordingUi ? 36 : 66, borderRadius: recordingUi ? 8 : 33, backgroundColor: recordingUi ? "#E23B3B" : evening ? "#8E4052" : "#70323E" }} />
          </Pressable>
          <Pressable onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
            <CameraRotate size={28} color={headerColor} />
          </Pressable>
        </View>

        {config.videoFirst ? (
          <Text style={{ textAlign: "center", fontFamily: fonts.medium, fontSize: 11, color: headerColor, opacity: 0.8, marginBottom: 4 }}>
            Hold to record
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", alignSelf: "center", marginBottom: 12, padding: 4, borderRadius: 999, backgroundColor: evening ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)" }}>
          {(["photo", "video"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                hapticSelect();
                setCaptureMode(mode);
              }}
              style={{ paddingHorizontal: 22, paddingVertical: 8, borderRadius: 999, backgroundColor: captureMode === mode ? (evening ? "#8E4052" : "#70323E") : "transparent" }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: captureMode === mode ? "#FFF8F4" : headerColor }}>{mode === "photo" ? "Photo" : "Video"}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={{ color: "#FF8BC8", textAlign: "center", fontFamily: fonts.medium, paddingBottom: 6 }}>{error}</Text> : null}
      </SafeAreaView>
    </View>
  );
}