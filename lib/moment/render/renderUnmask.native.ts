import { Platform } from "react-native";

import type { RenderInput, RenderOutput } from "./renderTypes";
import { patchRenderJob, readRenderJob, saveRenderJob, type RenderJobRecord } from "./renderJobs";
import { requestNativeRenderMount } from "./nativeRenderBus";

const POLL_MS = 400;
const TIMEOUT_MS = 420_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function renderUnmaskMediaNative(
  input: RenderInput,
  onProgress?: (ratio: number, label: string) => void,
): Promise<RenderOutput> {
  if (Platform.OS === "web") {
    const { renderUnmaskMediaWeb } = await import("./renderUnmask.web");
    return renderUnmaskMediaWeb(input, onProgress);
  }

  const jobId = `job-${Date.now()}`;
  const job: RenderJobRecord = { id: jobId, input, status: "queued", progress: 0, label: "Queued" };
  await saveRenderJob(job);

  onProgress?.(0.01, "Starting device processor…");

  requestNativeRenderMount(jobId);
  const started = Date.now();

  while (Date.now() - started < TIMEOUT_MS) {
    const current = await readRenderJob(jobId);
    if (!current) {
      await sleep(POLL_MS);
      continue;
    }
    onProgress?.(current.progress, current.label);

    if (current.status === "done" && current.output) {
      return current.output;
    }
    if (current.status === "error") {
      throw new Error(current.error || "render_failed");
    }
    await sleep(POLL_MS);
  }

  throw new Error("render_timeout");
}