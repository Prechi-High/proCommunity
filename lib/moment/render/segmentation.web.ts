import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs-core";

import { withTimeout } from "./withTimeout";

let segmenter: bodySegmentation.BodySegmenter | null = null;
let loading: Promise<bodySegmentation.BodySegmenter> | null = null;

/** Prefer tfjs runtime — no fragile MediaPipe CDN on mobile Safari. */
export async function getSegmenter(): Promise<bodySegmentation.BodySegmenter> {
  if (segmenter) return segmenter;
  if (!loading) {
    loading = (async () => {
      await withTimeout(tf.ready(), 12_000, "tf_ready_timeout");
      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch {
        await tf.setBackend("cpu");
        await tf.ready();
      }
      const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
      try {
        segmenter = await withTimeout(
          bodySegmentation.createSegmenter(model, {
            runtime: "tfjs",
            modelType: "general",
          }),
          20_000,
          "segmenter_load_timeout",
        );
      } catch {
        // Last resort: mediapipe CDN runtime
        segmenter = await withTimeout(
          bodySegmentation.createSegmenter(model, {
            runtime: "mediapipe",
            modelType: "general",
            solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747",
          }),
          20_000,
          "mediapipe_load_timeout",
        );
      }
      return segmenter!;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

export async function segmentPerson(source: HTMLImageElement | HTMLVideoElement) {
  const s = await getSegmenter();
  const people = await withTimeout(
    s.segmentPeople(source, { flipHorizontal: false, multiSegmentation: false, segmentBodyParts: false }),
    8_000,
    "segment_timeout",
  );
  if (!people[0]) throw new Error("segment");
  return people[0];
}

export async function disposeSegmenter() {
  if (segmenter) await segmenter.dispose();
  segmenter = null;
  loading = null;
}