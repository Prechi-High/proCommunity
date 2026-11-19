import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SearchField } from "@/components/unmask-ui/SearchField";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { MOMENT_SOUNDS, selectedSoundLabel, type SoundOption } from "@/lib/moment/creatorCatalog";
import { pickLocalAudio } from "@/lib/moment/localMediaPicker";
import { momentFlow } from "@/lib/moment/flowTheme";
import { playStudioSound, stopStudioSound } from "@/lib/moment/studioAudio";
import type { CreatorSettings } from "@/lib/moment/types";

/** Music only — BG/looks/FX removed from create. */
export type CreatorToolKind = "music" | null;

function rowCard(children: React.ReactNode, active?: boolean) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: active ? momentFlow.pillPink : momentFlow.card,
        borderWidth: 1,
        borderColor: active ? momentFlow.accent : momentFlow.accentSoft,
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export function CreatorToolSheets({
  open,
  creator,
  onClose,
  onChange,
  mediaKind,
}: {
  open: CreatorToolKind;
  creator: CreatorSettings;
  onClose: () => void;
  onChange: (next: CreatorSettings) => void;
  mediaKind?: "photo" | "video";
  audioBehavior?: unknown;
  onAudioBehaviorChange?: unknown;
}) {
  const [musicQuery, setMusicQuery] = useState("");
  const [soundBusy, setSoundBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState("");

  if (mediaKind === "video") {
    // Sounds are for photos / slides only
    if (!open) return null;
    return (
      <ActionSheet open title="Music" onClose={onClose}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted, lineHeight: 20 }}>
          Sound is for photos and slides. Videos keep their own audio — Unmask just adds the brand mark and product context.
        </Text>
      </ActionSheet>
    );
  }

  async function previewSound(track: SoundOption) {
    try {
      setPickerError("");
      const result = await playStudioSound(
        { soundId: track.id, localSoundUri: undefined, localSoundName: undefined },
        { loop: false, toggleStop: true },
      );
      if (result === "playing") setPreviewId(track.id);
      else setPreviewId(null);
      if (result === "failed") setPickerError("Couldn’t play that preview. Check network / allow autoplay.");
    } catch {
      setPreviewId(null);
      setPickerError("Couldn’t play that preview on this device.");
    }
  }

  async function useLibrarySound(track: SoundOption) {
    hapticSelect();
    await stopStudioSound();
    setPreviewId(null);
    onChange({ ...creator, soundId: track.id, localSoundUri: undefined, localSoundName: undefined });
    onClose();
  }

  async function pickDeviceSound() {
    setPickerError("");
    setSoundBusy(true);
    try {
      const picked = await pickLocalAudio();
      if (!picked) {
        setPickerError("No supported audio file selected (mp3, m4a, wav).");
        return;
      }
      await stopStudioSound();
      onChange({ ...creator, soundId: undefined, localSoundUri: picked.uri, localSoundName: picked.name });
      onClose();
    } finally {
      setSoundBusy(false);
    }
  }

  if (!open) return null;

  const filteredSounds = MOMENT_SOUNDS.filter(
    (s) =>
      !musicQuery.trim() ||
      s.title.toLowerCase().includes(musicQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(musicQuery.toLowerCase()),
  );

  return (
    <ActionSheet open title="Music" onClose={onClose}>
      <ScrollView
        style={{ maxHeight: Platform.OS === "web" ? 420 : 380 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
      >
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted, lineHeight: 18 }}>
          Preview plays once — tap Play again to stop. On your status, sound loops for about 30 seconds.
        </Text>
        <SearchField value={musicQuery} onChange={setMusicQuery} placeholder="Search sounds" />
        {selectedSoundLabel(creator) ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: momentFlow.accent }}>
              Using: {selectedSoundLabel(creator)}
            </Text>
            <Pressable
              onPress={() => {
                void stopStudioSound();
                onChange({ ...creator, soundId: undefined, localSoundUri: undefined, localSoundName: undefined });
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.muted }}>Remove</Text>
            </Pressable>
          </View>
        ) : null}
        {filteredSounds.map((track) =>
          rowCard(
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>{track.title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>
                    {track.artist} · {track.duration} · {track.category}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void previewSound(track)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: momentFlow.accentSoft }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: momentFlow.accent }}>
                    {previewId === track.id ? "Stop" : "Play"}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => void useLibrarySound(track)}
                style={{ paddingVertical: 12, borderRadius: 999, backgroundColor: momentFlow.accent, alignItems: "center" }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>Use sound</Text>
              </Pressable>
            </View>,
            creator.soundId === track.id,
          ),
        )}
        <Pressable
          disabled={soundBusy}
          onPress={() => void pickDeviceSound()}
          style={{
            padding: 14,
            borderRadius: 16,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: momentFlow.accent,
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.accent }}>
            {soundBusy ? "Opening…" : "Upload your own sound"}
          </Text>
        </Pressable>
        {pickerError ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.warnInk }}>{pickerError}</Text>
        ) : null}
      </ScrollView>
    </ActionSheet>
  );
}
