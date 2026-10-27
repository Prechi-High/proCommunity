import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { attachmentOptions, type EvidenceSelection } from "@/lib/tracking/api";
import { EvidencePicker } from "@/components/tracking/EvidencePicker";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
export function ExperienceAttachment({
  value,
  onChange,
  journeyValue,
  onJourneyChange,
}: {
  productId?: string | null;
  value: string;
  onChange: (id: string) => void;
  journeyValue?: string;
  onJourneyChange?: (id: string) => void;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const [chosen, setChosen] = useState<EvidenceSelection | null>(null);
  const sources = useQuery({
    queryKey: ["evidence-options", uid],
    queryFn: attachmentOptions,
    enabled: !!uid && !!(value || journeyValue),
  });
  const resolved =
    chosen && (chosen.id === value || chosen.id === journeyValue)
      ? chosen
      : sources.data?.find((x) => x.id === (value || journeyValue));
  const selection =
    resolved ||
    (value
      ? {
          kind: "experience" as const,
          id: value,
          title: "Attached experience",
          detail: "Original author and usage context",
          visibility: "public",
        }
      : journeyValue
        ? {
            kind: "journey" as const,
            id: journeyValue,
            title: "Attached product timeline",
            detail: "Usage over time",
            visibility: "public",
          }
        : null);
  return (
    <EvidencePicker
      value={selection}
      onChange={(v) => {
        setChosen(v);
        onChange(v?.kind === "experience" ? v.id : "");
        onJourneyChange?.(v?.kind === "journey" ? v.id : "");
      }}
    />
  );
}
export function AttachedExperienceLink({
  id,
  journeyId,
  attachedBy,
}: {
  id?: string | null;
  journeyId?: string | null;
  attachedBy?: string;
}) {
  return (
    <AttachedEvidence
      experienceId={id}
      journeyId={journeyId}
      attachedBy={attachedBy}
    />
  );
}
