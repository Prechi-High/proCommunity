export type RoomProductChip = {
  id?: string;
  name: string;
  brand?: string;
};

export type RoomRole = "host" | "cohost" | "speaker" | "listener";

export type RoomSeat = {
  id: string;
  name: string;
  role: RoomRole;
  speaking: boolean;
  muted: boolean;
  you?: boolean;
  creatorMark?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
};

export type RoomReactionKind =
  | "laugh"
  | "wow"
  | "sad"
  | "heart"
  | "hundred"
  | "clap"
  | "fist"
  | "up"
  | "down"
  | "wave";

export type RoomPresence = {
  id: string;
  name: string;
  anonymous?: boolean;
  micOn?: boolean;
  speaking?: boolean;
  creatorMark?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
};

export type RecordingCopy = {
  label: string;
  active: boolean;
  failed: boolean;
};
