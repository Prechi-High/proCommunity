import { useState } from "react";
import { Share } from "react-native";
import { useRouter, type Href } from "expo-router";

import { RoomExperience, type RoomNote, type RoomReaction } from "@/components/room/RoomExperience";
import { arrangeRoom } from "@/lib/room/seats";
import type { RoomReactionKind } from "@/lib/room/types";

const EMPTY_COUNTS: Record<RoomReactionKind, number> = { same: 0, differs: 0, clarify: 0, keep: 0 };

export function RoomPreview({ host = false }: { host?: boolean }) {
  const router = useRouter();
  const [minimized, setMinimized] = useState(false);
  const [micOn, setMicOn] = useState(host);
  const [anonymous, setAnonymous] = useState(false);
  const [requested, setRequested] = useState(false);
  const [invited, setInvited] = useState(false);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<RoomNote[]>([]);
  const [reactions, setReactions] = useState<RoomReaction[]>([
    { id: "sample-same", kind: "same", name: "Dee" },
  ]);
  const [counts, setCounts] = useState<Record<RoomReactionKind, number>>({ ...EMPTY_COUNTS, same: 3, clarify: 1 });
  const [cohostIds, setCohostIds] = useState<string[]>(["bea"]);
  const [powers, setPowers] = useState<Record<string, { can_end?: boolean; can_manage_cohosts?: boolean }>>({
    bea: { can_end: false, can_manage_cohosts: true },
  });

  const arranged = arrangeRoom({
    hostId: "ada",
    hostName: "Ada Mensah",
    hostHandle: "ada",
    hostMark: "creator-ada",
    hostAvatar: null,
    youId: host ? "ada" : "you",
    youName: host ? "Ada Mensah" : "You",
    youRole: host ? "host" : "listener",
    youMicOn: micOn,
    youAnonymous: anonymous,
    cohostIds: ["bea"],
    speakingIds: ["ada"],
    people: [
      { id: "ada", name: "Ada Mensah", micOn: true, speaking: true, creatorMark: "creator-ada", handle: "ada" },
      { id: "bea", name: "Bea Okonkwo", micOn: false, speaking: false, creatorMark: "creator-bea", handle: "bea" },
      { id: "cal", name: "Cal Nguyen", micOn: true, speaking: false },
      { id: "dee", name: "Dee Patel" },
      { id: "eli", name: "Eli Brooks" },
      { id: "hidden", name: "Hidden", anonymous: true },
    ],
  });

  function react(kind: RoomReactionKind) {
    const id = `local-${Date.now()}`;
    setReactions((current) => [...current, { id, kind, name: "You" }].slice(-4));
    setCounts((current) => ({ ...current, [kind]: current[kind] + 1 }));
    setTimeout(() => setReactions((current) => current.filter((item) => item.id !== id)), 2600);
  }

  return (
    <RoomExperience
      sample
      phase="live"
      title="Why this cleanser pills in humidity"
      description="Owners compare texture, fragrance, and whether the tight feeling shows up after a week."
      products={[{ id: "hydrating-cleanser", name: "Hydrating Cleanser", brand: "CeraVe" }]}
      topic="Texture"
      recordingStatus="recording"
      hostName="Ada Mensah"
      hostHandle="ada"
      hostMark="creator-ada"
      listenerCount={arranged.stage.length + arranged.audience.length + 1}
      anonymousCount={anonymous ? 2 : 1}
      stage={arranged.stage}
      audience={arranged.audience}
      youRole={host ? "host" : "listener"}
      micOn={micOn}
      canSpeak={host}
      micRequested={requested}
      micDenied={false}
      anonymous={anonymous}
      canToggleAnonymous={!host}
      invited={invited}
      onDismissInvite={() => setInvited(false)}
      reactions={reactions}
      reactionCounts={counts}
      onReact={react}
      notes={notes}
      message={message}
      onMessage={setMessage}
      onSend={() => {
        const text = message.trim();
        if (!text) return;
        setNotes((current) => [...current, { id: `note-${Date.now()}`, name: "You", text }]);
        setMessage("");
      }}
      onToggleMic={() => setMicOn((value) => !value)}
      onRequestMic={() => setRequested(true)}
      onLeave={() => router.replace("/room?preview=1" as Href)}
      onEnd={host ? () => router.replace("/room?preview=1" as Href) : undefined}
      onExit={() => router.replace("/room?preview=1" as Href)}
      onShare={() => void Share.share({ message: "Why this cleanser pills in humidity — a Room on Unmask" })}
      onToggleAnonymous={setAnonymous}
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onExpand={() => setMinimized(false)}
      canHear
      onStartAudio={() => undefined}
      pendingMics={host ? [{ user_id: "cal", display_name: "Cal Nguyen" }] : []}
      onApproveMic={() => setInvited(true)}
      onDenyMic={() => undefined}
      canManage={host}
      creators={[
        { user_id: "bea", display_name: "Bea Okonkwo", handle: "bea", creator_mark: "creator-bea" },
        { user_id: "noor", display_name: "Noor Ali", handle: "noor", creator_mark: "creator-noor" },
      ]}
      cohostIds={cohostIds}
      cohostPermissions={powers}
      onManage={(action, userId) => {
        if (!userId) return;
        if (action === "add_cohost") setCohostIds((ids) => Array.from(new Set([...ids, userId])));
        if (action === "remove_cohost") setCohostIds((ids) => ids.filter((id) => id !== userId));
        if (action === "grant_end" || action === "revoke_end" || action === "grant_cohost_management" || action === "revoke_cohost_management") {
          setPowers((current) => ({
            ...current,
            [userId]: {
              ...(current[userId] || {}),
              ...(action === "grant_end" ? { can_end: true } : {}),
              ...(action === "revoke_end" ? { can_end: false } : {}),
              ...(action === "grant_cohost_management" ? { can_manage_cohosts: true } : {}),
              ...(action === "revoke_cohost_management" ? { can_manage_cohosts: false } : {}),
            },
          }));
        }
      }}
    />
  );
}
