import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export async function pickLocalAudio(): Promise<{ uri: string; name: string } | null> {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return null;
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name)) {
          resolve(null);
          return;
        }
        resolve({ uri: URL.createObjectURL(file), name: file.name });
      };
      input.click();
    });
  }
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["audio/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const asset = picked.assets[0];
    return { uri: asset.uri, name: asset.name };
  } catch {
    return null;
  }
}

export async function pickLocalBackground(): Promise<{ uri: string; name: string; kind: "photo" | "video" } | null> {
  if (Platform.OS === "web") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.fileName || "Background",
      kind: asset.type === "video" ? "video" : "photo",
    };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || "Background",
    kind: asset.type === "video" ? "video" : "photo",
  };
}