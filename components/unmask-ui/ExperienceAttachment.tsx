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
  const selection = value
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
      : null;
  return (
    <EvidencePicker
      value={selection}
      onChange={(v) => {
        onChange(v?.kind === "experience" ? v.id : "");
        onJourneyChange?.(v?.kind === "journey" ? v.id : "");
      }}
    />
  );
}
export function AttachedExperienceLink({
  id,
  journeyId,
}: {
  id?: string | null;
  journeyId?: string | null;
}) {
  return <AttachedEvidence experienceId={id} journeyId={journeyId} />;
}
