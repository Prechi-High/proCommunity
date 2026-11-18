import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle } from "react-native-svg";

import { CameraRotate, Clock, Handbag, ImageSquare, Lightning, Sparkle, Waveform, X } from "@/components/icons";
import { momentFlow } from "@/lib/moment/flowTheme";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

const MAX_RECORD_MS = 60000;

export function MomentCamera({
  kind,
  onClose,
  onShot,
  onAddProduct,
}: {
  kind: MomentKind;
  onClose: () => void;
  onShot: (uri: string, mediaKind: "photo" | "video") => void;
  onAddProduct?: () => void;
}) {
  const config = momentConfig(kind);
  const camera = useRef<CameraView>(null);
  const shotRef = useRef(onShot);
  shotRef.current = onShot;
  const [permission, requestPermission] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [recordingUi, setRecordingUi] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recording = useRef(false);
  const held = useRef(false);
  const webStop = useRef<(() => Promise<string>) | null>(null);
  const suppressTap = useRef(false);
  const recordTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [captureMode, setCaptureMode] = useState<"photo" | "video" | "multi">(config.defaultMode);
  const [error, setError] = useState("");
  const evening = kind === "evening";
  const cream = kind === "currently" || kind === "morning";
  const headerColor = evening ? "#FFF8F4" : cream ? "#2D1B1B" : "#FFF8F4";

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (recordTick.current) clearInterval(recordTick.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  function startRecordUi() {
    setRecordMs(0);
    setRecordingUi(true);
    if (recordTick.current) clearInterval(recordTick.current);
    recordTick.current = setInterval(() => {
      setRecordMs((ms) => {
        if (ms >= MAX_RECORD_MS) return ms;
        return ms + 100;
      });
    }, 100);
  }

  function stopRecordUi() {
    setRecordingUi(false);
    if (recordTick.current) {
      clearInterval(recordTick.current);
      recordTick.current = null;
    }
    setRecordMs(0);
  }

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
    if (!ready || recording.current) return;
    recording.current = true;
    startRecordUi();
    setError("");
    if (Platform.OS === "web") {
      const clip = await beginWebClip();
      if (!clip) {
        recording.current = false;
        stopRecordUi();
        held.current = false;
        setError("Hold to record isn’t available here. Switch to Photo.");
        return;
      }
      webStop.current = clip.stop;
      return;
    }
    if (!mic?.granted) {
      const next = await requestMic();
      if (!next.granted) {
        recording.current = false;
        stopRecordUi();
        setError("Video needs the microphone.");
        return;
      }
    }
    try {
      void camera.current
        ?.recordAsync({ maxDuration: 60 })
        .then((clip) => {
          if (clip?.uri) shotRef.current(clip.uri, "video");
        })
        .catch(() => setError("Couldn’t record that."));
    } catch {
      setError("Couldn’t start recording.");
      recording.current = false;
      stopRecordUi();
    }
  }

  function pressIn() {
    if (captureMode !== "video") return;
    held.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      held.current = true;
      void startRecord();
    }, 200);
  }

  async function stopRecord() {
    if (!recording.current) return;
    if (webStop.current) {
      const stop = webStop.current;
      webStop.current = null;
      void stop()
        .then((uri) => shotRef.current(uri, "video"))
        .catch(() => setError("That clip didn’t save."));
    } else if (Platform.OS !== "web") {
      camera.current?.stopRecording();
    }
    recording.current = false;
    stopRecordUi();
    held.current = false;
  }

  async function toggleVideoRecord() {
    if (captureMode !== "video") return;
    if (recording.current) {
      await stopRecord();
    } else {
      void startRecord();
    }
  }

  function pressOut() {
    if (captureMode !== "video") {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      return;
    }
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (!held.current && !recording.current) return;

    if (held.current) suppressTap.current = true;
    void stopRecord();
  }

  async function shoot() {
    if (!ready) {
      setError("Camera is still starting…");
      return;
    }
    setError("");
    try {
      if (Platform.OS !== "web" && captureMode === "video") {
        setCaptureMode("photo");
        await new Promise((r) => setTimeout(r, 160));
      }
      const photo = await camera.current?.takePictureAsync({
        quality: 0.85,
        base64: Platform.OS === "web" || Platform.OS === "android",
        skipProcessing: Platform.OS === "android",
        shutterSound: false,
      });
      if (!photo) return;
      const uri =
        photo.uri ||
        (photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : "");
      if (!uri) return;
      shotRef.current(uri, "photo");
    } catch {
      setError("Couldn’t take that photo. Try again.");
    }
  }

  async function upload() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.75, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` : asset.uri;
    shotRef.current(uri, asset.type === "video" ? "video" : "photo");
  }

  const ringProgress = Math.min(1, recordMs / MAX_RECORD_MS);
  const ringSize = 84;
  const stroke = 4;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ flex: 1, backgroundColor: evening ? "#0A0610" : cream ? "#F9F5EB" : "#1A0A14" }}>
      {permission?.granted ? (
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing={facing}
          mode={captureMode === "video" ? "video" : "picture"}
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
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 4, zIndex: 2 }}>
          <Pressable onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <X size={24} color={headerColor} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(74,21,44,0.92)" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF8F4" }}>
                {config.title} {config.emoji}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => setTorch((v) => !v)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Lightning size={22} color={torch ? "#FF8BC8" : headerColor} weight={torch ? "fill" : "regular"} />
          </Pressable>
        </View>

        {recordingUi ? (
          <View style={{ position: "absolute", top: 108, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>
              {Math.ceil(recordMs / 1000)}s
            </Text>
          </View>
        ) : null}

        {/* Right-side capture tools (reference mock) */}
        <View style={{ position: "absolute", right: 14, top: "38%", gap: 18, zIndex: 2 }}>
          {[Clock, Sparkle, Waveform].map((Icon, i) => (
            <Pressable
              key={i}
              onPress={() => hapticSelect()}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}
            >
              <Icon size={22} color="#FFF8F4" />
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => {
            hapticSelect();
            onAddProduct?.();
          }}
          style={{
            alignSelf: "center",
            marginBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 11,
            borderRadius: 999,
            backgroundColor: momentFlow.accent,
            zIndex: 2,
          }}
        >
          <Handbag size={18} color="#FFF8F4" weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>Add Product</Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignSelf: "center", marginBottom: 12, padding: 4, borderRadius: 999, backgroundColor: evening ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)", zIndex: 2 }}>
          {(["photo", "video", "multi"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                hapticSelect();
                setCaptureMode(mode);
              }}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: captureMode === mode ? momentFlow.accent : "transparent" }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: captureMode === mode ? "#FFF8F4" : headerColor }}>
                {mode === "photo" ? "Photo" : mode === "video" ? "Video" : "Multi"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ paddingBottom: 8, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
          <Pressable onPress={() => void upload()} style={{ width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: evening ? "rgba(255,255,255,0.35)" : "rgba(45,27,27,0.25)", alignItems: "center", justifyContent: "center", backgroundColor: evening ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.65)" }}>
            <ImageSquare size={26} color={headerColor} />
          </Pressable>
          <Pressable
            accessibilityLabel={captureMode === "video" ? "Tap or hold to record" : "Take photo"}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={() => {
              if (suppressTap.current) {
                suppressTap.current = false;
                return;
              }
              if (captureMode === "photo") void shoot();
              else void toggleVideoRecord();
            }}
            style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}
          >
            {recordingUi ? (
              <Svg width={ringSize} height={ringSize} style={{ position: "absolute" }}>
                <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
                <Circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  stroke="#FF6B9D"
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={circumference * (1 - ringProgress)}
                  rotation={-90}
                  origin={`${ringSize / 2}, ${ringSize / 2}`}
                />
              </Svg>
            ) : null}
            <View
              style={{
                width: recordingUi ? 32 : 66,
                height: recordingUi ? 32 : 66,
                borderRadius: recordingUi ? 8 : 33,
                backgroundColor: recordingUi ? "#E23B3B" : evening ? "#8E4052" : "#70323E",
                borderWidth: recordingUi ? 0 : 4,
                borderColor: evening ? "#C9A227" : "#FF6B9D",
              }}
            />
          </Pressable>
          <Pressable onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
            <CameraRotate size={28} color={headerColor} />
          </Pressable>
        </View>
        {error ? <Text style={{ color: "#FF8BC8", textAlign: "center", fontFamily: fonts.medium, paddingBottom: 6, zIndex: 2 }}>{error}</Text> : null}
      </SafeAreaView>
    </View>
  );
}