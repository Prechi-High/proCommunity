import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SearchField } from "@/components/unmask-ui/SearchField";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import {
  MOMENT_BACKGROUNDS,
  MOMENT_EFFECTS,
  MOMENT_LIGHTING,
  MOMENT_LOOKS,
  MOMENT_SOUNDS,
  selectedSoundLabel,
  type SoundOption,
} from "@/lib/moment/creatorCatalog";
import { pickLocalAudio, pickLocalBackground } from "@/lib/moment/localMediaPicker";
import { momentFlow } from "@/lib/moment/flowTheme";
import { playStudioSound, stopStudioSound } from "@/lib/moment/studioAudio";
import type { CreatorSettings, MomentAudioBehavior } from "@/lib/moment/types";

export type CreatorToolKind = "music" | "looks" | "background" | "lighting" | "beauty" | "effects" | "timer" | null;

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

const AUDIO_MIX: { id: MomentAudioBehavior; label: string; hint: string }[] = [
  { id: "keep_original", label: "Keep video audio", hint: "Preserve sound from your clip" },
  { id: "replace", label: "Replace with music", hint: "Use only the selected Unmask track" },
  { id: "mix", label: "Mix both", hint: "Blend clip audio with music where supported" },
];

export function CreatorToolSheets({
  open,
  creator,
  onClose,
  onChange,
  mediaKind,
  audioBehavior = "keep_original",
  onAudioBehaviorChange,
}: {
  open: CreatorToolKind;
  creator: CreatorSettings;
  onClose: () => void;
  onChange: (next: CreatorSettings) => void;
  mediaKind?: "photo" | "video";
  audioBehavior?: MomentAudioBehavior;
  onAudioBehaviorChange?: (next: MomentAudioBehavior) => void;
}) {
  const titles: Record<Exclude<CreatorToolKind, null>, string> = {
    music: "Music",
    looks: "Looks",
    background: "Background",
    lighting: "Light",
    beauty: "Beauty",
    effects: "FX",
    timer: "Timer & grid",
  };

  const [musicQuery, setMusicQuery] = useState("");
  const [soundBusy, setSoundBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState("");

  useEffect(() => {
    return () => {
      /* dock / preview owns shared player — don't kill on sheet close */
    };
  }, []);

  async function previewSound(track: SoundOption) {
    try {
      setPreviewId(track.id);
      setPickerError("");
      const ok = await playStudioSound(
        { soundId: track.id, localSoundUri: undefined, localSoundName: undefined },
        { loop: true },
      );
      if (!ok) {
        setPreviewId(null);
        setPickerError("Couldn’t play that preview. Check network / allow autoplay.");
      }
    } catch {
      setPreviewId(null);
      setPickerError("Couldn’t play that preview on this device.");
    }
  }

  async function useLibrarySound(track: SoundOption) {
    hapticSelect();
    const next = { ...creator, soundId: track.id, localSoundUri: undefined, localSoundName: undefined };
    onChange(next);
    await playStudioSound(next, { loop: true });
    setPreviewId(track.id);
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
      onChange({ ...creator, soundId: undefined, localSoundUri: picked.uri, localSoundName: picked.name });
      onClose();
    } finally {
      setSoundBusy(false);
    }
  }

  async function pickDeviceBackground() {
    setPickerError("");
    const picked = await pickLocalBackground();
    if (!picked) {
      setPickerError("Couldn’t load that background.");
      return;
    }
    onChange({
      ...creator,
      backgroundId: "custom",
      localBackgroundUri: picked.uri,
      backgroundBlurAmount: creator.backgroundBlurAmount ?? 8,
    });
  }

  function resetTool(kind: CreatorToolKind) {
    if (kind === "music") {
      void stopStudioSound();
      onChange({ ...creator, soundId: undefined, localSoundUri: undefined, localSoundName: undefined });
    }
    if (kind === "looks") onChange({ ...creator, lookId: undefined });
    if (kind === "background") onChange({ ...creator, backgroundId: "original", localBackgroundUri: undefined, backgroundBlurAmount: 0 });
    if (kind === "lighting") onChange({ ...creator, lightingId: undefined });
    if (kind === "effects") onChange({ ...creator, effectId: undefined });
  }

  const blurAmount = creator.backgroundBlurAmount ?? 0;
  const sceneActive = (creator.backgroundId && creator.backgroundId !== "original") || Boolean(creator.localBackgroundUri);

  if (!open) return null;

  const filteredSounds = MOMENT_SOUNDS.filter(
    (s) =>
      !musicQuery.trim() ||
      s.title.toLowerCase().includes(musicQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(musicQuery.toLowerCase()),
  );

  return (
    <ActionSheet open title={titles[open]} onClose={onClose}>
      <ScrollView style={{ maxHeight: Platform.OS === "web" ? 420 : 380 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        {open === "music" ? (
          <>
            <SearchField value={musicQuery} onChange={setMusicQuery} placeholder="Search sounds" />
            {selectedSoundLabel(creator) ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: momentFlow.accent }}>Using: {selectedSoundLabel(creator)}</Text>
                <Pressable onPress={() => resetTool("music")}>
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
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: momentFlow.accent }}>{previewId === track.id ? "Playing…" : "Play"}</Text>
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
              style={{ padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: momentFlow.accent, alignItems: "center", gap: 6 }}
            >
              {soundBusy ? <ActivityIndicator color={momentFlow.accent} /> : null}
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.accent }}>From my device</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted, textAlign: "center" }}>Attach a local audio file to this Unmask draft.</Text>
            </Pressable>
            {mediaKind === "video" && onAudioBehaviorChange ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted }}>Uploaded video audio</Text>
                {AUDIO_MIX.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => {
                      hapticSelect();
                      onAudioBehaviorChange(row.id);
                    }}
                  >
                    {rowCard(
                      <View style={{ gap: 2 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>{row.label}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>{row.hint}</Text>
                      </View>,
                      audioBehavior === row.id,
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {open === "looks" ? (
          <>
            {MOMENT_LOOKS.map((look) => {
              const active = (look.id === "none" ? !creator.lookId : creator.lookId === look.id);
              return (
                <Pressable
                  key={look.id}
                  onPress={() => {
                    hapticSelect();
                    onChange({ ...creator, lookId: look.id === "none" ? undefined : look.id });
                    if (look.id !== "none") onClose();
                  }}
                >
                  {rowCard(
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: look.thumb, borderWidth: 1, borderColor: momentFlow.accentSoft }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>{look.title}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>Applies to live preview & final render</Text>
                      </View>
                      {active ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: momentFlow.accent }}>On</Text> : null}
                    </View>,
                    active,
                  )}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {open === "background" ? (
          <>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted, lineHeight: 18 }}>
              We cut you out cleanly and replace the entire scene. Adjust blur so the new background blends with you.
            </Text>
            {MOMENT_BACKGROUNDS.map((bg) => {
              const active = (creator.backgroundId ?? "original") === bg.id && !creator.localBackgroundUri;
              return (
                <Pressable
                  key={bg.id}
                  onPress={() => {
                    hapticSelect();
                    onChange({
                      ...creator,
                      backgroundId: bg.id,
                      localBackgroundUri: undefined,
                      backgroundBlurAmount: bg.mode === "blur" ? Math.max(blurAmount, 18) : blurAmount,
                    });
                  }}
                >
                  {rowCard(
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {bg.sceneUri ? (
                        <Image source={{ uri: bg.sceneUri }} style={{ width: 64, height: 64, borderRadius: 12 }} accessibilityIgnoresInvertColors />
                      ) : (
                        <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: typeof bg.thumb === "string" && bg.thumb.startsWith("http") ? undefined : (bg.thumb as string) }} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>{bg.title}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>
                          {bg.mode === "original" ? "Keep captured environment" : bg.mode === "blur" ? "Blur your real background" : "Full scene replacement"}
                        </Text>
                      </View>
                      {active ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: momentFlow.accent }}>Live</Text> : null}
                    </View>,
                    active,
                  )}
                </Pressable>
              );
            })}
            <Pressable onPress={() => void pickDeviceBackground()} style={{ padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: momentFlow.accent, gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.accent }}>From my device</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>Upload your own background, then dial blur to blend.</Text>
            </Pressable>
            {sceneActive ? (
              <View style={{ gap: 8, padding: 14, borderRadius: 16, backgroundColor: momentFlow.card, borderWidth: 1, borderColor: momentFlow.accentSoft }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Background blur · {blurAmount}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>Softer scenes blend more naturally with hair and edges.</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[0, 6, 12, 18, 28, 40].map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => {
                        hapticSelect();
                        onChange({ ...creator, backgroundBlurAmount: v });
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: blurAmount === v ? momentFlow.accent : momentFlow.accentSoft,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: blurAmount === v ? "#FFF8F4" : momentFlow.ink }}>{v === 0 ? "Sharp" : v}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <Pressable onPress={() => resetTool("background")} style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.muted }}>Reset to Original</Text>
            </Pressable>
          </>
        ) : null}

        {open === "lighting" ? (
          MOMENT_LIGHTING.map((light) => {
            const active = creator.lightingId === light.id;
            return (
              <Pressable
                key={light.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, lightingId: active ? undefined : light.id });
                  onClose();
                }}
              >
                {rowCard(
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>{light.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{light.hint}</Text>
                  </View>,
                  active,
                )}
              </Pressable>
            );
          })
        ) : null}

        {open === "beauty" ? (
          rowCard(
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Subtle beauty</Text>
              <Switch
                value={!!creator.beautyEnabled}
                onValueChange={(beautyEnabled) => onChange({ ...creator, beautyEnabled })}
                trackColor={{ true: momentFlow.accent, false: momentFlow.accentSoft }}
              />
            </View>,
          )
        ) : null}

        {open === "effects" ? (
          MOMENT_EFFECTS.map((effect) => {
            const active = (creator.effectId ?? "none") === effect.id;
            return (
              <Pressable
                key={effect.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, effectId: effect.id === "none" ? undefined : effect.id });
                  onClose();
                }}
              >
                {rowCard(
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>{effect.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{effect.hint}</Text>
                  </View>,
                  active,
                )}
              </Pressable>
            );
          })
        ) : null}

        {open === "timer" ? (
          <>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted }}>Self-timer</Text>
            {[0, 3, 5, 10].map((sec) => {
              const on = (creator.timerSec ?? 0) === sec;
              return (
                <Pressable
                  key={sec}
                  onPress={() => onChange({ ...creator, timerSec: sec || undefined })}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: on ? momentFlow.accent : momentFlow.card }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: on ? "#FFF8F4" : momentFlow.ink }}>{sec ? `${sec} seconds` : "Off"}</Text>
                </Pressable>
              );
            })}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted, marginTop: 4 }}>Capture grid</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, backgroundColor: momentFlow.card }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Composition grid</Text>
              <Switch
                value={!!creator.gridEnabled}
                onValueChange={(gridEnabled) => onChange({ ...creator, gridEnabled })}
                trackColor={{ true: momentFlow.accent, false: momentFlow.accentSoft }}
              />
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted }}>Speed</Text>
            {([0.5, 1, 2] as const).map((speed) => {
              const on = (creator.captureSpeed ?? 1) === speed;
              return (
                <Pressable key={speed} onPress={() => onChange({ ...creator, captureSpeed: speed })} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: on ? momentFlow.accent : momentFlow.card }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: on ? "#FFF8F4" : momentFlow.ink }}>{speed}x</Text>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {pickerError ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.warnInk }}>{pickerError}</Text> : null}
      </ScrollView>
    </ActionSheet>
  );
}