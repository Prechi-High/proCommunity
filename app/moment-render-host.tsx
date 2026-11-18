import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { fonts } from "@/constants/theme";
import { momentFlow } from "@/lib/moment/flowTheme";
import { patchRenderJob, readRenderJob } from "@/lib/moment/render/renderJobs";

export default function MomentRenderHost() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const [status, setStatus] = useState("Preparing Unmask render…");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;

    void (async () => {
      const job = await readRenderJob(String(jobId));
      if (!job?.input) {
        setStatus("Render job not found.");
        return;
      }
      await patchRenderJob(String(jobId), { status: "running", progress: 0.02, label: "Starting…" });
      try {
        const { renderUnmaskMediaWeb } = await import("@/lib/moment/render/renderUnmask.web");
        const output = await renderUnmaskMediaWeb(job.input, (ratio, label) => {
          if (!alive) return;
          setProgress(ratio);
          setStatus(label);
          void patchRenderJob(String(jobId), { progress: ratio, label, status: "running" });
        });
        await patchRenderJob(String(jobId), { status: "done", progress: 1, label: "Done", output });
        setStatus("Unmask ready.");
        setProgress(1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Render failed";
        await patchRenderJob(String(jobId), { status: "error", error: msg, label: msg });
        setStatus(msg);
      }
    })();

    return () => {
      alive = false;
    };
  }, [jobId]);

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      <ActivityIndicator color={momentFlow.accent} size="large" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink, textAlign: "center" }}>{status}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{Math.round(progress * 100)}%</Text>
    </View>
  );
}