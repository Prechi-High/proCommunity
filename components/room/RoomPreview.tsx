import { useState } from "react";
import { Platform, Share } from "react-native";

import { RoomExperience, type RoomNote, type RoomReaction } from "@/components/room/RoomExperience";
import { arrangeRoom } from "@/lib/room/seats";
import type { RoomReactionKind } from "@/lib/room/types";

const PEOPLE = [
  { id: "ada", name: "Ada Mensah", micOn: true, speaking: true, creatorMark: "creator-ada", handle: "ada" },
  { id: "bea", name: "Bea Okonkwo", micOn: false, creatorMark: "creator-bea", handle: "bea" },
  { id: "noor", name: "Noor Ali", micOn: false, creatorMark: "creator-noor", handle: "noor" },
  { id: "cal", name: "Cal Nguyen", micOn: true },
  { id: "dee", name: "Dee Patel", micOn: false },
  { id: "eli", name: "Eli Brooks", micOn: true, speaking: true },
  { id: "faye", name: "Faye Cole", micOn: false },
  { id: "gio", name: "Gio Rossi" },
  { id: "hana", name: "Hana Kim" },
  { id: "ivan", name: "Ivan Brooks" },
  { id: "june", name: "June Park" },
];

export function RoomPreview({ screen = "prejoin" }: { screen?: "prejoin" | "live" | "host" }) {
  const host = screen === "host";
  const [phase, setPhase] = useState<"prejoin" | "connecting" | "live">(screen === "prejoin" ? "prejoin" : "live");
  const [minimized, setMinimized] = useState(false);
  const [micOn, setMicOn] = useState(host);
  const [anonymous, setAnonymous] = useState(false);
  const [requested, setRequested] = useState(false);
  const [outputOn, setOutputOn] = useState(true);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<RoomNote[]>([
    { id: "n1", name: "Dee Patel", text: "Mine pilled on the second night, only in humidity." },
  ]);
  const [reactions, setReactions] = useState<RoomReaction[]>([{ id: "r1", kind: "hundred", name: "Cal Nguyen" }]);

  const arranged = arrangeRoom({
    hostId: "ada",
    hostName: "Ada Mensah",
    hostHandle: "ada",
    hostMark: "creator-ada",
    youId: phase === "live" ? (host ? "ada" : "you") : null,
    youName: host ? "Ada Mensah" : "You",
    youRole: host ? "host" : requested ? "speaker" : "listener",
    youMicOn: micOn,
    youAnonymous: anonymous,
    cohostIds: ["bea", "noor"],
    speakingIds: ["ada", "eli"],
    people: PEOPLE,
  });

  async function share() {
    await Share.share({ message: "Why this cleanser pills in humidity — a Room on Unmask" });
  }

  async function copy() {
    const url = "https://unmask.app/room/session?preview=1";
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return;
    }
    await share();
  }

  return (
    <RoomExperience
      sample
      phase={phase}
      title="Why this cleanser pills in humidity"
      description="Owners compare texture, fragrance, and whether the tight feeling shows up after a week."
      products={[{ name: "Hydrating Cleanser", brand: "CeraVe" }]}
      topic="Texture"
      recordingStatus="recording"
      hostName="Ada Mensah"
      hostHandle="ada"
      hostMark="creator-ada"
      listenerCount={arranged.stage.length + arranged.audience.length + 406}
      anonymousCount={1}
      stage={arranged.stage}
      audience={arranged.audience}
      youRole={host ? "host" : "listener"}
      micOn={micOn}
      canSpeak={host || requested}
      micRequested={requested && !host}
      micDenied={false}
      anonymous={anonymous}
      canToggleAnonymous={!host}
      invited={false}
      onDismissInvite={() => undefined}
      reactions={reactions}
      onReact={(kind: RoomReactionKind) => setReactions((current) => [...current, { id: `e-${Date.now()}`, kind, name: "You" }].slice(-6))}
      notes={notes}
      message={message}
      onMessage={setMessage}
      onSend={() => {
        const text = message.trim();
        if (!text) return;
        setNotes((current) => [...current, { id: `n-${Date.now()}`, name: "You", text }]);
        setMessage("");
      }}
      onToggleMic={() => setMicOn((value) => !value)}
      onRequestMic={() => setRequested(true)}
      onLeave={() => setMinimized(false)}
      onEnd={host ? () => setPhase("prejoin") : undefined}
      onExit={() => setPhase("prejoin")}
      onRetry={() => setPhase("connecting")}
      onStart={() => {
        setPhase("connecting");
        setTimeout(() => setPhase("live"), 700);
      }}
      onShare={() => void share()}
      onCopyLink={() => void copy()}
      onToggleAnonymous={setAnonymous}
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onExpand={() => setMinimized(false)}
      outputOn={outputOn}
      onToggleOutput={() => setOutputOn((value) => !value)}
      canHear
      onStartAudio={() => undefined}
      pendingMics={host ? [{ user_id: "cal", display_name: "Cal Nguyen" }] : []}
      onApproveMic={() => undefined}
      onDenyMic={() => undefined}
      canManage={host}
      creators={[
        { user_id: "bea", display_name: "Bea Okonkwo", handle: "bea", creator_mark: "creator-bea" },
        { user_id: "noor", display_name: "Noor Ali", handle: "noor", creator_mark: "creator-noor" },
      ]}
      cohostIds={["bea", "noor"]}
      cohostPermissions={{ bea: { can_end: false, can_manage_cohosts: true } }}
      onManage={() => undefined}
    />
  );
}
