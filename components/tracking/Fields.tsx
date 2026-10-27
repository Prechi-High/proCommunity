import { durablePhoto } from "@/lib/tracking/photos";
import { useState } from "react";
import { Image, Platform, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts } from "@/constants/theme";
import { ActionButton, FilterChips, MediaFrame } from "@/components/unmask-ui";
export const durationOptions = [
  "Just started",
  "Week 1",
  "Week 2",
  "Week 3",
  "1 month",
  "2 months",
  "3 months",
  "6+ months",
];
export const statusNames: Record<string, string> = {
  active: "Still using",
  paused: "Paused",
  finished: "Finished",
  stopped: "Used before",
  purchased: "Not started",
};
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: fonts.semibold,
        fontSize: 16,
        lineHeight: 23,
        color: colors.ink,
      }}
    >
      {children}
    </Text>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: fonts.regular,
        fontSize: 14,
        lineHeight: 22,
        color: colors.inkSoft,
      }}
    >
      {children}
    </Text>
  );
}
export function Input({
  value,
  onChange,
  label,
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={multiline ? "Tell it in your own words…" : ""}
        placeholderTextColor={colors.inkSoft}
        style={{
          padding: 15,
          minHeight: multiline ? 110 : 50,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 16,
          fontFamily: fonts.regular,
          fontSize: 16,
          lineHeight: 24,
          color: colors.ink,
          textAlignVertical: "top",
        }}
      />
    </View>
  );
}
export function PhotoField({
  label,
  value,
  onChange,
  camera = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  camera?: boolean;
}) {
  const [error, setError] = useState("");
  async function pick(take = false) {
    setError("");
    try {
      if (take) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(
            "Camera access is off. Enable it in your device settings, or continue without a photo.",
          );
          return;
        }
      }
      const r = take
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            base64: true,
          });
      if (!r.canceled) {
        const asset = r.assets[0];
        onChange(asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : await durablePhoto(asset.uri));
      }
    } catch {
      setError(
        "The camera couldn’t open. You can try again or continue without a photo.",
      );
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <ActionButton
        tone="secondary"
        label={
          camera
            ? value
              ? "Retake photo"
              : "Take a photo now"
            : value
              ? `Change ${label.toLowerCase()}`
              : label
        }
        onPress={() => void pick(camera)}
      />
      {value ? (
        <>
          <MediaFrame uri={value} label={label} ratio={1.6} corners={false} />
          <ActionButton
            tone="ghost"
            label="Remove photo"
            onPress={() => onChange("")}
          />
        </>
      ) : null}
      {error ? <Note>{error}</Note> : null}
    </View>
  );
}
export function PrivacyChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Label>Who can see this?</Label>
      <FilterChips
        options={["Private", "Public"]}
        value={value === "public" ? "Public" : "Private"}
        onChange={(v) => onChange(v === "Public" ? "public" : "private")}
      />
      <Note>
        {value === "public"
          ? "Anyone can read this timeline and its public updates, including duration, routine, skin-type context and photos you choose to share. Your context can help someone choose a product."
          : "Only you can open this timeline and its private photos. Attaching it to a public post requires a separate choice to make it public."}
      </Note>
    </View>
  );
}
export function ReminderFields({
  logOn,
  routineOn,
  time,
  onChange,
}: {
  logOn: boolean;
  routineOn: boolean;
  time: string;
  onChange: (v: {
    logOn?: boolean;
    routineOn?: boolean;
    time?: string;
  }) => void;
}) {
  return (
    <View
      style={{
        gap: 14,
        padding: 18,
        borderRadius: 20,
        backgroundColor: "#F5F0EB",
      }}
    >
      <Label>A gentle nudge, only if you want it.</Label>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ flex: 1, fontFamily: fonts.regular, color: colors.ink }}>
          Remind me to log an update each week
        </Text>
        <Switch
          accessibilityLabel="Weekly update reminder"
          value={logOn}
          onValueChange={(v) => onChange({ logOn: v })}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ flex: 1, fontFamily: fonts.regular, color: colors.ink }}>
          Remind me of my daily routine
        </Text>
        <Switch
          accessibilityLabel="Daily routine reminder"
          value={routineOn}
          onValueChange={(v) => onChange({ routineOn: v })}
        />
      </View>
      {logOn || routineOn ? (
        <>
          <Input
            label="Your local reminder time (24-hour HH:MM)"
            value={time}
            onChange={(v) => onChange({ time: v })}
          />
          <Note>
            Reminders appear in Unmask notifications. You can also export a
            calendar reminder after saving for alerts when Unmask is closed.
            Paused or finished products won’t receive in-app nudges.
          </Note>
        </>
      ) : null}
      <Note>No streaks to lose. Pick up whenever you’re ready.</Note>
    </View>
  );
}
