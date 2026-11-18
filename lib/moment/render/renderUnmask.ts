import { Platform } from "react-native";

import type { RenderInput, RenderOutput } from "./renderTypes";

export type { RenderInput, RenderOutput };

export async function renderUnmaskMedia(
  input: RenderInput,
  onProgress?: (ratio: number, label: string) => void,
): Promise<RenderOutput> {
  if (Platform.OS === "web") {
    const { renderUnmaskMediaWeb } = await import("./renderUnmask.web");
    return renderUnmaskMediaWeb(input, onProgress);
  }
  const { renderUnmaskMediaNative } = await import("./renderUnmask.native");
  return renderUnmaskMediaNative(input, onProgress);
}