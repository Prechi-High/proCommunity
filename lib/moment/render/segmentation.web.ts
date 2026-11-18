import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs-core";

let segmenter: bodySegmentation.BodySegmenter | null = null;
let loading: Promise<bodySegmentation.BodySegmenter> | null = null;

export async function getSegmenter(): Promise<bodySegmentation.BodySegmenter> {
  if (segmenter) return segmenter;
  if (!loading) {
    loading = (async () => {
      await tf.ready();
      await tf.setBackend("webgl");
      const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
      segmenter = await bodySegmentation.createSegmenter(model, {
        runtime: "mediapipe",
        modelType: "general",
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
      });
      return segmenter;
    })();
  }
  return loading;
}

export async function segmentPerson(source: HTMLImageElement | HTMLVideoElement) {
  const s = await getSegmenter();
  const people = await s.segmentPeople(source, { flipHorizontal: false, multiSegmentation: false, segmentBodyParts: false });
  if (!people[0]) throw new Error("segment");
  return people[0];
}

export async function disposeSegmenter() {
  if (segmenter) await segmenter.dispose();
  segmenter = null;
  loading = null;
}