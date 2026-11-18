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

/** Native docs: ms. Web HTMLVideoElement: seconds. Heuristic covers both. */
export function normalizePickerDurationMs(duration: number | null | undefined): number | undefined {
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return undefined;
  // Values under ~1000 are almost certainly seconds (or tiny clips in ms — still safe as ms)
  if (duration < 1000) return Math.round(duration * 1000);
  return Math.round(duration);
}

function detectKind(raw: ImagePicker.ImagePickerAsset): "photo" | "video" {
  if (raw.type === "video") return "video";
  if (raw.type === "image") return "photo";
  const mime = (raw.mimeType || raw.file?.type || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "photo";
  const name = (raw.fileName || raw.uri || "").toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/.test(name)) return "video";
  return "photo";
}

export async function pickDeviceMomentMedia(opts?: {
  videoFirst?: boolean;
  videosOnly?: boolean;
}): Promise<PickMomentMediaResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return {
        ok: false,
        reason: "permission",
        message: "Photo library access is needed to upload. Enable it in Settings and try again.",
      };
    }

    // Never request base64 for videos — it hangs mobile browsers and blows memory.
    // Prefer blob:/file URIs; photos can stay as uri without base64 too.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: opts?.videosOnly ? ["videos"] : ["videos", "images"],
      allowsMultipleSelection: false,
      videoMaxDuration: MOMENT_MEDIA_LIMITS.maxVideoDurationSec,
      quality: 0.85,
      base64: false,
    });

    if (result.canceled || !result.assets[0]) {
      return { ok: false, reason: "cancelled", message: "" };
    }

    const raw = result.assets[0];
    const mediaKind = detectKind(raw);
    const mime = raw.mimeType || raw.file?.type || "";

    // Prefer blob/file uri. On web, expo already returns object URL when base64=false.
    let uri = raw.uri;
    if (Platform.OS === "web" && raw.file && (!uri || uri.startsWith("data:"))) {
      uri = URL.createObjectURL(raw.file);
    }
    if (!uri) {
      return { ok: false, reason: "unknown", message: "Couldn’t read that file. Try another video." };
    }

    if (mime && !mimeAllowed(mime, mediaKind)) {
      return {
        ok: false,
        reason: "unsupported",
        message: "That file type isn’t supported. Try MP4, MOV, or a standard photo format.",
      };
    }

    const durationMs = normalizePickerDurationMs(raw.duration ?? undefined);
    if (mediaKind === "video" && durationMs != null && durationMs > MOMENT_MEDIA_LIMITS.maxVideoDurationSec * 1000) {
      return {
        ok: false,
        reason: "too_long",
        message: `Videos must be ${MOMENT_MEDIA_LIMITS.maxVideoDurationSec} seconds or shorter.`,
      };
    }

    const sizeMb = bytesToMb(raw.fileSize ?? raw.file?.size ?? null);
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
      width: raw.width || undefined,
      height: raw.height || undefined,
      fileSizeBytes: raw.fileSize ?? raw.file?.size,
      source: "device_upload",
      mimeType: mime || undefined,
      posterUri: mediaKind === "photo" ? uri : undefined,
    };

    return { ok: true, asset, mediaKind };
  } catch (e) {
    return {
      ok: false,
      reason: "unknown",
      message: e instanceof Error ? e.message : "Couldn’t open your library. Try again.",
    };
  }
}