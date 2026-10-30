import type { RoomPresence, RoomRole, RoomSeat } from "./types";

export type ArrangeRoomInput = {
  hostId?: string | null;
  hostName?: string | null;
  hostHandle?: string | null;
  hostMark?: string | null;
  hostAvatar?: string | null;
  youId?: string | null;
  youName?: string | null;
  youRole: RoomRole;
  youMicOn: boolean;
  youAnonymous: boolean;
  people: RoomPresence[];
  cohostIds: string[];
  speakingIds: string[];
  /** People who were brought on the mic, even while they are muted. */
  speakerIds?: string[];
};

function rank(seat: RoomSeat) {
  if (seat.role === "host") return 0;
  if (seat.speaking) return 1;
  if (seat.role === "cohost") return 2;
  return 3;
}

/** Place the host, co-hosts, and open mics on stage. Everyone else listens. */
export function arrangeRoom(input: ArrangeRoomInput) {
  const stage: RoomSeat[] = [];
  const audience: RoomSeat[] = [];
  const seen = new Set<string>();
  const hostId = input.hostId || "";
  const youAreHost = !!input.youId && !!hostId && input.youId === hostId;
  const hostPerson = input.people.find((person) => person.id === hostId);

  stage.push({
    id: hostId || "host",
    name: youAreHost ? input.youName || "You" : input.hostName || hostPerson?.name || "Host",
    role: "host",
    speaking: youAreHost ? input.speakingIds.includes(input.youId || "") : input.speakingIds.includes(hostId),
    muted: youAreHost ? !input.youMicOn : hostPerson ? !hostPerson.micOn : true,
    you: youAreHost,
    creatorMark: input.hostMark || hostPerson?.creatorMark || null,
    handle: input.hostHandle || hostPerson?.handle || null,
    avatarUrl: input.hostAvatar || hostPerson?.avatarUrl || null,
  });
  if (hostId) seen.add(hostId);

  for (const person of input.people) {
    if (!person.id || seen.has(person.id) || person.anonymous) continue;
    seen.add(person.id);
    const cohost = input.cohostIds.includes(person.id);
    const speaking = !!person.speaking || input.speakingIds.includes(person.id);
    const onStage = cohost || !!person.micOn || speaking || !!input.speakerIds?.includes(person.id);
    const seat: RoomSeat = {
      id: person.id,
      name: person.name || "Unmasker",
      role: cohost ? "cohost" : onStage ? "speaker" : "listener",
      speaking,
      muted: !person.micOn,
      creatorMark: person.creatorMark,
      handle: person.handle,
      avatarUrl: person.avatarUrl,
    };
    if (onStage) stage.push(seat);
    else audience.push(seat);
  }

  if (input.youId && !seen.has(input.youId) && !input.youAnonymous) {
    const cohost = input.youRole === "cohost" || input.cohostIds.includes(input.youId);
    const speaking = input.speakingIds.includes(input.youId);
    const onStage = input.youRole === "host" || input.youRole === "speaker" || cohost || input.youMicOn || speaking || !!input.speakerIds?.includes(input.youId);
    const seat: RoomSeat = {
      id: input.youId,
      name: input.youName || "You",
      role: input.youRole === "host" ? "host" : cohost ? "cohost" : onStage ? "speaker" : "listener",
      speaking,
      muted: !input.youMicOn,
      you: true,
    };
    if (onStage) stage.push(seat);
    else audience.unshift(seat);
  }

  stage.sort((a, b) => rank(a) - rank(b));
  const visibleStage = stage.slice(0, 8);
  const overflow = stage.slice(8);
  return { stage: visibleStage, audience: [...overflow, ...audience] };
}
