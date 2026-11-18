import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { CameraRotate, Clock, Handbag, ImageSquare, Lightning, X } from "@/components/icons";
import { CreatorToolSheets, type CreatorToolKind } from "@/components/moment/CreatorToolSheets";
import { StudioDock } from "@/components/moment/StudioDock";
import { momentFlow } from "@/lib/moment/flowTheme";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import type { CreatorSettings } from "@/lib/moment/types";

const MAX_RECORD_MS = 60000;

export function MomentCamera({
  kind,
  creator = { backgroundId: "original", captureSpeed: 1 },
  onCreatorChange,
  lastThumb,
  onClose,
  onShot,
  onPickDevice,
  onContinueMulti,
  onAddProduct,
}: {
  kind: MomentKind;
  creator?: CreatorSettings;
  onCreatorChange: (next: CreatorSettings) => void;
  lastThumb?: string;
  onClose: () => void;
  onShot: (uri: string, mediaKind: "photo" | "video", multi: boolean) => void;
  /** Device library → parent routes through upload/review (not live BG while recording). */
  onPickDevice?: () => void;
  onContinueMulti?: () => void;
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
  const recording = useRef(false);
  const webStop = useRef<(() => Promise<string>) | null>(null);
  const recordTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [torchMode, setTorchMode] = useState<"off" | "on" | "auto">("off");
  const [captureMode, setCaptureMode] = useState<"photo" | "video" | "multi">(config.defaultMode);
  const [error, setError] = useState("");
  const [toolOpen, setToolOpen] = useState<CreatorToolKind>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const torchOn = torchMode === "on";
  const evening = kind === "evening";
  const cream = kind === "currently" || kind === "morning";
  const headerColor = evening ? "#FFF8F4" : cream ? "#2D1B1B" : "#FFF8F4";

  // Capture-only creator: timer/grid — BG/looks apply after recording on Setup/Preview
  const captureCreator: CreatorSettings = {
    ...creator,
    backgroundId: "original",
    localBackgroundUri: undefined,
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (recordTick.current) clearInterval(recordTick.current);
      if (maxStopTimer.current) clearTimeout(maxStopTimer.current);
    };
  }, []);

  function clearRecordTimers() {
    if (recordTick.current) {
      clearInterval(recordTick.current);
      recordTick.current = null;
    }
    if (maxStopTimer.current) {
      clearTimeout(maxStopTimer.current);
      maxStopTimer.current = null;
    }
  }

  function startRecordUi() {
    setRecordMs(0);
    setRecordingUi(true);
    clearRecordTimers();
    recordTick.current = setInterval(() => {
      setRecordMs((ms) => Math.min(MAX_RECORD_MS, ms + 100));
    }, 100);
    maxStopTimer.current = setTimeout(() => {
      void stopRecord();
    }, MAX_RECORD_MS);
  }

  function stopRecordUi() {
    setRecordingUi(false);
    clearRecordTimers();
    setRecordMs(0);
  }

  async function beginWebClip() {
    if (typeof document === "undefined") return null;
    // Prefer the camera preview video inside this screen
    const video = document.querySelector("video") as (HTMLVideoElement & { captureStream?: () => MediaStream }) | null;
    const base = video?.captureStream?.();
    if (!base) return null;
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      audio.getAudioTracks().forEach((track) => base.addTrack(track));
    } catch {
      /* silent clip */
    }
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(
      (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
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
        setError("Recording isn’t available here. Upload a video instead.");
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
        ?.recordAsync({ maxDuration: Math.ceil(MAX_RECORD_MS / 1000) })
        .then((clip) => {
          if (clip?.uri) shotRef.current(clip.uri, "video", captureMode === "multi");
        })
        .catch(() => {
          if (recording.current) setError("Couldn’t record that.");
        })
        .finally(() => {
          // Native maxDuration / stopRecording always lands here — clear UI
          recording.current = false;
          webStop.current = null;
          stopRecordUi();
        });
    } catch {
      setError("Couldn’t start recording.");
      recording.current = false;
      stopRecordUi();
    }
  }

  async function stopRecord() {
    if (!recording.current) return;
    const stop = webStop.current;
    webStop.current = null;
    recording.current = false;
    stopRecordUi();
    if (stop) {
      try {
        const uri = await stop();
        shotRef.current(uri, "video", captureMode === "multi");
      } catch {
        setError("That clip didn’t save.");
      }
      return;
    }
    if (Platform.OS !== "web") {
      try {
        camera.current?.stopRecording();
      } catch {
        setError("Couldn’t stop recording.");
      }
    }
  }

  async function toggleVideoRecord() {
    if (captureMode !== "video" && captureMode !== "multi") return;
    if (recording.current || recordingUi) {
      await stopRecord();
    } else {
      await startRecord();
    }
  }

  async function waitTimer() {
    const sec = creator.timerSec ?? 0;
    if (!sec) return;
    for (let n = sec; n > 0; n -= 1) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);
  }

  async function shoot() {
    if (!ready) {
      setError("Camera is still starting…");
      return;
    }
    setError("");
    try {
      await waitTimer();
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
      const uri = photo.uri || (photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : "");
      if (!uri) return;
      shotRef.current(uri, "photo", captureMode === "multi");
    } catch {
      setError("Couldn’t take that photo. Try again.");
    }
  }

  function openLibrary() {
    if (onPickDevice) {
      onPickDevice();
      return;
    }
    setError("Use Upload from device on the previous screen.");
  }

  const ringProgress = Math.min(1, recordMs / MAX_RECORD_MS);
  const ringSize = 84;
  const stroke = 4;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const videoMode = captureMode === "video" || captureMode === "multi";

  return (
    <View style={{ flex: 1, backgroundColor: evening ? "#0A0610" : cream ? "#F9F5EB" : "#1A0A14" }}>
      {permission?.granted ? (
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing={facing}
          mode={captureMode === "video" || captureMode === "multi" ? "video" : "picture"}
          enableTorch={torchOn && facing === "back"}
          mirror={facing === "front"}
          onCameraReady={() => setReady(true)}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: headerColor, textAlign: "center" }}>
            Allow camera — or upload a video you already filmed
          </Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={{ marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: "#FF6B9D" }}
          >
            <Text style={{ fontFamily: fonts.semibold, color: "#1A0A14" }}>Allow camera</Text>
          </Pressable>
          <Pressable
            onPress={openLibrary}
            style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "#FF8BC8" }}
          >
            <Text style={{ fontFamily: fonts.semibold, color: "#FF8BC8" }}>Upload from device</Text>
          </Pressable>
        </View>
      )}

      {/* Kind tint only — no live BG matting while recording */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: config.tint }} />
      {config.scrim ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: config.scrim }} />
      ) : null}

      {creator.gridEnabled ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.35 }}>
          {[0.33, 0.66].map((p) => (
            <View key={`v${p}`} style={{ position: "absolute", left: `${p * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: "#FFF8F4" }} />
          ))}
          {[0.33, 0.66].map((p) => (
            <View key={`h${p}`} style={{ position: "absolute", top: `${p * 100}%`, left: 0, right: 0, height: 1, backgroundColor: "#FFF8F4" }} />
          ))}
        </View>
      ) : null}
      {countdown !== null ? (
        <View
          style={{
            position: "absolute",
            alignSelf: "center",
            top: "42%",
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 32, color: "#FFF8F4" }}>{countdown}</Text>
        </View>
      ) : null}

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
          <Pressable
            onPress={() => {
              hapticSelect();
              setTorchMode((m) => (m === "off" ? "on" : m === "on" ? "auto" : "off"));
            }}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Lightning size={22} color={torchMode !== "off" ? "#FF8BC8" : headerColor} weight={torchMode !== "off" ? "fill" : "regular"} />
            {torchMode === "auto" ? (
              <Text style={{ position: "absolute", bottom: 2, fontFamily: fonts.bold, fontSize: 8, color: "#FF8BC8" }}>A</Text>
            ) : null}
          </Pressable>
        </View>

        {recordingUi ? (
          <View
            style={{
              position: "absolute",
              top: 108,
              alignSelf: "center",
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.55)",
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>{Math.ceil(recordMs / 1000)}s · tap to stop</Text>
          </View>
        ) : (
          <View
            style={{
              position: "absolute",
              top: 108,
              alignSelf: "center",
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#FFF8F4" }}>
              Record first — background & style after
            </Text>
          </View>
        )}

        <View style={{ position: "absolute", right: 14, top: "28%", gap: 12, zIndex: 2 }}>
          {[
            { Icon: CameraRotate, active: false, onPress: () => setFacing((f) => (f === "front" ? "back" : "front")) },
            { Icon: Clock, active: Boolean(creator.timerSec || creator.gridEnabled), onPress: () => setToolOpen("timer") },
          ].map(({ Icon, active, onPress }, i) => (
            <Pressable
              key={i}
              onPress={() => {
                hapticSelect();
                onPress();
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: active ? "rgba(74,21,44,0.9)" : "rgba(0,0,0,0.35)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: active ? 1 : 0,
                borderColor: "#FF8BC8",
              }}
            >
              <Icon size={22} color="#FFF8F4" />
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* Capture dock: music/timer only — no BG while recording */}
        <View style={{ paddingHorizontal: 12, marginBottom: 10, zIndex: 3 }}>
          <StudioDock
            creator={captureCreator}
            open={toolOpen}
            onOpen={setToolOpen}
            hideTools={["background", "looks", "lighting", "effects"]}
          />
        </View>

        {captureMode === "multi" && lastThumb ? (
          <Pressable
            onPress={() => onContinueMulti?.()}
            style={{
              alignSelf: "center",
              marginBottom: 10,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.9)",
              zIndex: 2,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.accent }}>Continue with clips →</Text>
          </Pressable>
        ) : null}

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

        <View
          style={{
            flexDirection: "row",
            alignSelf: "center",
            marginBottom: 12,
            padding: 4,
            borderRadius: 999,
            backgroundColor: evening ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)",
            zIndex: 2,
          }}
        >
          {(["photo", "video", "multi"] as const).map((mode) => (
            <Pressable
              key={mode}
              disabled={recordingUi}
              onPress={() => {
                hapticSelect();
                setCaptureMode(mode);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: captureMode === mode ? momentFlow.accent : "transparent",
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: captureMode === mode ? "#FFF8F4" : headerColor }}>
                {mode === "photo" ? "Photo" : mode === "video" ? "Video" : "Multi"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            paddingBottom: 8,
            paddingHorizontal: 28,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2,
          }}
        >
          <Pressable
            onPress={() => (lastThumb ? onContinueMulti?.() : openLibrary())}
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: evening ? "rgba(255,255,255,0.35)" : "rgba(45,27,27,0.25)",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: evening ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.65)",
              overflow: "hidden",
            }}
          >
            {lastThumb ? (
              <Image source={{ uri: lastThumb }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : (
              <ImageSquare size={26} color={headerColor} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel={videoMode ? (recordingUi ? "Stop recording" : "Start recording") : "Take photo"}
            onPress={() => {
              hapticSelect();
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
          <Pressable
            onPress={openLibrary}
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: evening ? "rgba(255,255,255,0.35)" : "rgba(45,27,27,0.25)",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: evening ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.65)",
            }}
          >
            <ImageSquare size={26} color={headerColor} />
          </Pressable>
        </View>
        {error ? (
          <Text style={{ color: "#FF8BC8", textAlign: "center", fontFamily: fonts.medium, paddingBottom: 6, zIndex: 2 }}>{error}</Text>
        ) : null}
      </SafeAreaView>

      <CreatorToolSheets open={toolOpen} creator={creator} onClose={() => setToolOpen(null)} onChange={onCreatorChange} />
    </View>
  );
}

export { MomentCamera as CameraStudioScreen };
