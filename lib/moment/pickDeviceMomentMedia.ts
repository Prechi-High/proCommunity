import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { bytesToMb, MOMENT_MEDIA_LIMITS } from "@/lib/moment/mediaLimits";
import type { MomentMediaAsset } from "@/lib/moment/types";

export type PickMomentMediaFailure = {
  ok: false;
  reason: "cancelled" | "permission" | "unsupported" | "too_large" | "too_long" | "unknown";
  message: string;
};

export type PickMomentMediaSuccess = {
  ok: true;
  asset: MomentMediaAsset;
  mediaKind: "photo" | "video";
};

export type PickMomentMediaResult = PickMomentMediaSuccess | PickMomentMediaFailure;

function mimeAllowed(mime: string | undefined, kind: "photo" | "video"): boolean {
  if (!mime) return true;
  const prefixes = kind === "video" ? MOMENT_MEDIA_LIMITS.videoMimePrefixes : MOMENT_MEDIA_LIMITS.photoMimePrefixes;
  return prefixes.some((p) => mime.startsWith(p));
}

export async function pickDeviceMomentMedia(opts?: {
  videoFirst?: boolean;
}): Promise<PickMomentMediaResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return {
      ok: false,
      reason: "permission",
      message: "Photo library access is needed to upload. Enable it in Settings and try again.",
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: opts?.videoFirst ? ["videos", "images"] : ["videos", "images"],
    allowsMultipleSelection: false,
    videoMaxDuration: MOMENT_MEDIA_LIMITS.maxVideoDurationSec,
    quality: 0.85,
    base64: Platform.OS === "web",
  });

  if (result.canceled || !result.assets[0]) {
    return { ok: false, reason: "cancelled", message: "" };
  }

  const raw = result.assets[0];
  const mediaKind: "photo" | "video" = raw.type === "video" ? "video" : "photo";
  const uri = raw.base64
    ? `data:${raw.mimeType || (mediaKind === "video" ? "video/mp4" : "image/jpeg")};base64,${raw.base64}`
    : raw.uri;

  const mime = raw.mimeType || "";
  if (!mimeAllowed(mime, mediaKind)) {
    return {
      ok: false,
      reason: "unsupported",
      message: "That file type isn’t supported. Try MP4, MOV, or a standard photo format.",
    };
  }

  const durationMs = raw.duration != null ? Math.round(raw.duration * 1000) : undefined;
  if (mediaKind === "video" && durationMs != null && durationMs > MOMENT_MEDIA_LIMITS.maxVideoDurationSec * 1000) {
    return {
      ok: false,
      reason: "too_long",
      message: `Videos must be ${MOMENT_MEDIA_LIMITS.maxVideoDurationSec} seconds or shorter.`,
    };
  }

  const sizeMb = bytesToMb(raw.fileSize ?? null);
  const maxMb = mediaKind === "video" ? MOMENT_MEDIA_LIMITS.maxVideoFileSizeMb : MOMENT_MEDIA_LIMITS.maxPhotoFileSizeMb;
  if (sizeMb != null && sizeMb > maxMb) {
    return {
      ok: false,
      reason: "too_large",
      message: `That file is too large (max ${maxMb} MB for ${mediaKind === "video" ? "videos" : "photos"}).`,
    };
  }

  const asset: MomentMediaAsset = {
    id: `upload-${Date.now()}`,
    uri,
    kind: mediaKind,
    durationMs,
    width: raw.width,
    height: raw.height,
    fileSizeBytes: raw.fileSize,
    source: "device_upload",
    mimeType: raw.mimeType,
    posterUri: mediaKind === "photo" ? uri : undefined,
  };

  return { ok: true, asset, mediaKind };
}