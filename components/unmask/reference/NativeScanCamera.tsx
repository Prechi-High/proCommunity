import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FocusCorners } from "@/components/brand/FocusCorners";
import { ImageSquare, Lightning, MagnifyingGlass } from "@/components/icons";
import { fonts } from "@/constants/theme";
import type { VisionAsset } from "@/lib/productVision";
import { Button, Copy, Header, Heading, Notice, ink, s } from "./ui";
export function NativeScanCamera({
  onCapture,
  onClose,
  onPhoto,
}: {
  onCapture: (asset: VisionAsset) => void;
  onClose: () => void;
  onPhoto: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shoot = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      if (photo)
        onCapture({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          base64: photo.base64,
          mimeType: "image/jpeg",
          fileName: "product.jpg",
        });
    } catch {
      setError("The photo could not be captured. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.page}>
        <Header
          onBack={onClose}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle flash"
              onPress={() => setTorch((v) => !v)}
            >
              <Lightning
                size={27}
                color={ink.brand}
                weight={torch ? "fill" : "regular"}
              />
            </Pressable>
          }
        />
        {permission?.granted ? (
          <View
            style={{ flex: 1, overflow: "hidden", backgroundColor: "#222" }}
          >
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing="back"
              enableTorch={torch}
              onCameraReady={() => setReady(true)}
              onMountError={() =>
                setError(
                  "Camera could not start. You can upload a photo instead.",
                )
              }
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 25,
                left: 20,
                right: 20,
                gap: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 23,
                  textAlign: "center",
                  color: "#FFFFFF",
                }}
              >
                Fit the product in the frame
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  textAlign: "center",
                  color: "#FFFFFF",
                }}
              >
                Keep the name and size visible
              </Text>
            </View>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FocusCorners size={280} color={ink.brand} />
            </View>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              padding: 25,
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <Heading>Allow camera access</Heading>
            <Copy>Unmask uses your camera to identify the product label.</Copy>
            <Button
              label="Allow camera"
              onPress={() => void requestPermission()}
            />
            <Button quiet label="Upload a photo instead" onPress={onPhoto} />
          </View>
        )}
        {error ? <Notice>{error}</Notice> : null}
        <View style={{ padding: 20, gap: 18, backgroundColor: "#FFFFFF" }}>
          <Text style={[s.small, { textAlign: "center" }]}>
            1 of 1 · front label
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-around",
            }}
          >
            <Pressable
              accessibilityLabel="Choose photo"
              onPress={onPhoto}
              style={{ alignItems: "center", gap: 8 }}
            >
              <ImageSquare size={28} color={ink.brand} />
              <Copy small>Photos</Copy>
            </Pressable>
            <Pressable
              accessibilityLabel="Take photo"
              disabled={!ready || busy}
              onPress={() => void shoot()}
              style={{
                width: 74,
                height: 74,
                borderRadius: 99,
                borderWidth: 2,
                borderColor: ink.brand,
                padding: 4,
                opacity: ready && !busy ? 1 : 0.4,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 99,
                  backgroundColor: ink.brand,
                }}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Search instead"
              onPress={onClose}
              style={{ alignItems: "center", gap: 8 }}
            >
              <MagnifyingGlass size={28} color={ink.brand} />
              <Copy small>Search instead</Copy>
            </Pressable>
          </View>
          <View style={s.rule} />
          <Pressable onPress={onClose}>
            <Text style={[s.small, { textAlign: "center" }]}>
              Having trouble?{" "}
              <Text
                style={{ color: ink.brand, textDecorationLine: "underline" }}
              >
                Enter the product name
              </Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
