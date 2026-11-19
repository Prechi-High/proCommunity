import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Camera, ImageSquare, UploadSimple, X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

/**
 * Simple capture: photo = take or upload; video = upload only (film on phone).
 */
export function MomentCaptureScreen({
  kind,
  productStory,
  mediaMode,
  onMediaModeChange,
  importing,
  importError,
  onBack,
  onClose,
  onTakePhoto,
  onUpload,
}: {
  kind: MomentKind;
  productStory?: boolean;
  mediaMode: "photo" | "video";
  onMediaModeChange: (m: "photo" | "video") => void;
  importing?: boolean;
  importError?: string;
  onBack: () => void;
  onClose: () => void;
  onTakePhoto: (uri: string) => void;
  onUpload: () => void;
}) {
  const config = momentConfig(kind);
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const title = productStory ? "My Product Story" : config.title;
  const evening = kind === "evening";
  const headerColor = evening ? "#FFF8F4" : "#2D1B1B";

  useEffect(() => {
    if (mediaMode === "photo" && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [mediaMode, permission, requestPermission]);

  async function shoot() {
    if (!ready) {
      setError("Camera is still starting…");
      return;
    }
    setError("");
    try {
      const photo = await camera.current?.takePictureAsync({
        quality: 0.85,
        base64: Platform.OS === "web" || Platform.OS === "android",
        skipProcessing: Platform.OS === "android",
        shutterSound: false,
      });
      if (!photo) return;
      const uri = photo.uri || (photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : "");
      if (!uri) return;
      onTakePhoto(uri);
    } catch {
      setError("Couldn’t take that photo. Try again or upload one.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: evening ? "#0A0610" : momentFlow.bg }}>
      {mediaMode === "photo" && permission?.granted ? (
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing={facing}
          mode="picture"
          mirror={facing === "front"}
          onCameraReady={() => setReady(true)}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: evening ? "#1A0A14" : "#F2D8D8" }} />
      )}

      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: config.tint }} />

      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, zIndex: 2 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={permission?.granted && mediaMode === "photo" ? "#FFF8F4" : headerColor} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(74,21,44,0.92)" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF8F4" }}>
                {title} {productStory ? "📖" : config.emoji}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <X size={22} color={permission?.granted && mediaMode === "photo" ? "#FFF8F4" : headerColor} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        <View
          style={{
            flexDirection: "row",
            alignSelf: "center",
            marginBottom: 16,
            padding: 4,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 2,
          }}
        >
          {(["photo", "video"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                hapticSelect();
                onMediaModeChange(mode);
                setError("");
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: mediaMode === mode ? momentFlow.accent : "transparent",
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>
                {mode === "photo" ? "Photo" : "Video"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mediaMode === "video" ? (
          <View style={{ marginHorizontal: 24, marginBottom: 28, gap: 14, zIndex: 2 }}>
            <View
              style={{
                padding: 18,
                borderRadius: momentFlow.radiusCard,
                backgroundColor: "rgba(0,0,0,0.55)",
                gap: 8,
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: "#FFF8F4" }}>Film on your phone</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,248,244,0.88)" }}>
                Record with your camera app, then upload here. Attach products and context — Unmask adds the brand mark for you.
              </Text>
            </View>
            <Pressable
              disabled={importing}
              onPress={() => {
                hapticSelect();
                onUpload();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                paddingVertical: 16,
                borderRadius: momentFlow.radiusPill,
                backgroundColor: momentFlow.accent,
              }}
            >
              <UploadSimple size={22} color="#FFF8F4" weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>
                {importing ? "Opening library…" : "Upload video"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingBottom: 16, paddingHorizontal: 28, zIndex: 2, gap: 14 }}>
            {!permission?.granted ? (
              <View style={{ gap: 12, marginBottom: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: headerColor, textAlign: "center" }}>
                  Allow camera, or upload from your gallery
                </Text>
                <Pressable
                  onPress={() => void requestPermission()}
                  style={{
                    alignSelf: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: momentFlow.accent,
                  }}
                >
                  <Text style={{ fontFamily: fonts.semibold, color: "#FFF8F4" }}>Allow camera</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable
                onPress={() => {
                  hapticSelect();
                  onUpload();
                }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.35)",
                }}
              >
                <ImageSquare size={26} color="#FFF8F4" />
              </Pressable>

              <Pressable
                disabled={!permission?.granted}
                onPress={() => {
                  hapticSelect();
                  void shoot();
                }}
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 37,
                  borderWidth: 4,
                  borderColor: "#FF6B9D",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: permission?.granted ? "#70323E" : "rgba(112,50,62,0.4)",
                }}
              >
                <Camera size={28} color="#FFF8F4" weight="fill" />
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticSelect();
                  setFacing((f) => (f === "front" ? "back" : "front"));
                }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.35)",
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }}>Flip</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                hapticSelect();
                onUpload();
              }}
              style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}
            >
              <UploadSimple size={18} color="#FFF8F4" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>
                {importing ? "Opening…" : "Upload from gallery"}
              </Text>
            </Pressable>
          </View>
        )}

        {error || importError ? (
          <Text style={{ color: "#FF8BC8", textAlign: "center", fontFamily: fonts.medium, paddingBottom: 10, zIndex: 2 }}>
            {error || importError}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
