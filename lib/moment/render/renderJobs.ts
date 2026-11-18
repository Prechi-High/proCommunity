import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RenderInput, RenderOutput } from "./renderTypes";

const PREFIX = "unmask:render-job:";

export type RenderJobRecord = {
  id: string;
  input: RenderInput;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  label: string;
  output?: RenderOutput;
  error?: string;
};

export async function saveRenderJob(job: RenderJobRecord) {
  await AsyncStorage.setItem(`${PREFIX}${job.id}`, JSON.stringify(job));
}

export async function readRenderJob(id: string): Promise<RenderJobRecord | null> {
  const raw = await AsyncStorage.getItem(`${PREFIX}${id}`);
  return raw ? (JSON.parse(raw) as RenderJobRecord) : null;
}

export async function patchRenderJob(id: string, patch: Partial<RenderJobRecord>) {
  const current = (await readRenderJob(id)) || null;
  if (!current) return;
  await saveRenderJob({ ...current, ...patch });
}