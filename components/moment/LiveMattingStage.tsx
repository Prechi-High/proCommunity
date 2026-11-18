import { Platform } from "react-native";

import type { CreatorSettings } from "@/lib/moment/types";

export function LiveMattingStage(props: {
  mediaUri?: string;
  mediaKind: "photo" | "video" | "camera";
  creator: CreatorSettings;
  cameraVideoSelector?: string;
  height?: number;
}) {
  if (Platform.OS !== "web") return null;
  // Lazy require so native bundles skip the web-only module graph.
  const { LiveMattingStage: WebStage } = require("./LiveMattingStage.web") as typeof import("./LiveMattingStage.web");
  return <WebStage {...props} />;
}