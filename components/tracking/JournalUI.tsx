import { useState } from "react";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Check,
  CaretDown,
  Camera,
  ShieldCheck,
  ImageSquare as Images,
} from "@/components/icons";
import { ActionButton, ActionSheet, MediaFrame, Skeleton } from "@/components/unmask-ui";
import { fonts, colors } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { Input, Label, Note, PhotoField, durationOptions } from "./Fields";
export const journal = {
  green: colors.ink,
  mint: "#F3F1EE",
  border: colors.line,
  paper: "#F8F7F5",
  ink: colors.ink,
};
export function JournalProgress({
  step,
  labels = ["Product", "Your use", "Changes", "Finish"],
}: {
  step: number;
  labels?: string[];
}) {
  return (
    <View
      accessibilityLabel={`Step ${step + 1} of ${labels.length}: ${labels[step]}`}
      style={{ gap: 12, paddingVertical: 8 }}
    >
      <View style={{ flexDirection: "row", gap: 5 }}>
        {labels.map((label, i) => (
          <View key={label} style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                height: 5,
                borderRadius: 9,
                backgroundColor: i <= step ? journal.green : "#E0E7E1",
              }}
            />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <View
                style={{
                  height: 19,
                  width: 19,
                  borderRadius: 10,
                  backgroundColor: i <= step ? journal.green : "#E8EDE7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i < step ? (
                  <Check size={12} color="#fff" weight="bold" />
                ) : (
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 10,
                      color: i === step ? "#fff" : "#68766F",
                    }}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 11,
                  color: i <= step ? journal.green : "#7C8780",
                  flexShrink: 1,
                }}
              >
                {label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
export function JournalCard({
  title,
  detail,
  children,
}: {
  title?: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        padding: 22,
        borderRadius: 26,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: journal.border,
        gap: 16,
        boxShadow: "0px 4px 20px rgba(35,74,55,.035)",
      }}
    >
      {title ? (
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 23,
            lineHeight: 29,
            color: journal.ink,
          }}
        >
          {title}
        </Text>
      ) : null}
      {detail ? <Note>{detail}</Note> : null}
      {children}
    </View>
  );
}
export function JournalProduct({
  name,
  brand,
  image,
  eyebrow = "YOUR PRODUCT JOURNAL",
}: {
  name: string;
  brand?: string | null;
  image?: string | null;
  eyebrow?: string;
}) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 22,
        backgroundColor: journal.paper,
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: journal.border,
      }}
    >
      <View style={{ width: 76 }}>
        <MediaFrame uri={image} label={name} ratio={1} corners={false} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 10,
            letterSpacing: 1.2,
            color: journal.green,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 19,
            lineHeight: 25,
            color: journal.ink,
          }}
        >
          {name}
        </Text>
        {brand ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              color: colors.inkSoft,
            }}
          >
            {brand}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
export function ChoiceCards({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; detail?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 9 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => {
              hapticSelect();
              onChange(o.value);
            }}
            style={({ pressed }) => ({
              borderWidth: active ? 2 : 1,
              borderColor: active ? journal.green : journal.border,
              borderRadius: 18,
              padding: 15,
              backgroundColor: active ? journal.mint : "#fff",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 15,
                  color: journal.ink,
                }}
              >
                {o.label}
              </Text>
              {o.detail ? (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.inkSoft,
                  }}
                >
                  {o.detail}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                width: 23,
                height: 23,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? journal.green : "#C8D2CA",
                backgroundColor: active ? journal.green : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {active ? <Check size={14} color="#fff" weight="bold" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
export function DurationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const custom = !!value && !durationOptions.includes(value);
  const [manual, setManual] = useState(custom);
  return (
    <View style={{ gap: 10 }}>
      <Label>How long have you used it?</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Usage duration: ${value || "Choose a duration"}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          hapticSelect();
          setOpen((v) => !v);
        }}
        style={{
          padding: 17,
          borderRadius: 17,
          backgroundColor: journal.paper,
          borderWidth: 1,
          borderColor: journal.border,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.medium,
            fontSize: 16,
            color: journal.ink,
          }}
        >
          {value || "Choose a duration"}
        </Text>
        <CaretDown size={19} color={journal.green} />
      </Pressable>
      {open ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: journal.border,
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {[...durationOptions, "Type my own…"].map((o) => (
            <Pressable
              key={o}
              accessibilityRole="button"
              accessibilityState={{ selected: value === o }}
              onPress={() => {
                setOpen(false);
                setManual(o === "Type my own…");
                if (o !== "Type my own…") onChange(o);
              }}
              style={{
                padding: 14,
                backgroundColor: value === o ? journal.mint : "#fff",
                borderBottomWidth: 1,
                borderBottomColor: "#EDF1EC",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 15,
                  color: journal.ink,
                }}
              >
                {o}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {manual || custom ? (
        <Input
          label="Your duration (e.g. 10 days or 5 weeks)"
          value={value}
          onChange={onChange}
        />
      ) : null}
    </View>
  );
}
export function ComparisonPhotoCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <LinearGradient
      colors={["#F3F1EE", "#FAF9F7"]}
      style={{ padding: 21, borderRadius: 25, gap: 13 }}
    >
      <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
        <Images size={24} color={journal.green} />
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 21,
            color: journal.ink,
            flex: 1,
          }}
        >
          Give your future self a starting point.
        </Text>
      </View>
      <Note>
        Take a photo of yourself or the skin area you want to follow. Add
        another with a later update to compare what changed—or stayed the
        same—while using this product.
      </Note>
      <PhotoField
        label="Add a starting or progress photo"
        value={value}
        onChange={onChange}
        camera
      />
      <Note>
        Optional. Use a similar angle and light each time. You choose who can
        see your photos. They are a visual record, not an automatic skin
        analysis.
      </Note>
    </LinearGradient>
  );
}
export function OwnershipPhotoCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [imageReady, setImageReady] = useState(false);
  return (
    <JournalCard
      title="Show the product behind your story."
      detail="Optional. You can post without a photo."
    >
      <ImageBackground
        source={require("@/assets/unmask-reference/scan-product.png")}
        resizeMode="cover"
        onLoadEnd={() => setImageReady(true)}
        accessibilityLabel="A skincare bottle framed by camera focus corners"
        style={{ height: 210, justifyContent: "flex-end", borderRadius: 20, overflow: "hidden", backgroundColor: journal.paper }}
        imageStyle={{ borderRadius: 20, width: "100%", height: "100%" }}
      >
        {!imageReady ? <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}><Skeleton height={210} radius={20} /></View> : null}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.78)"]} style={{ padding: 18, paddingTop: 65, gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={23} color="#fff" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#fff" }}>Your product. Your proof.</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "#fff" }}>An ownership marker helps your shared timeline stand out—after review.</Text>
        </LinearGradient>
      </ImageBackground>
      <PhotoField
        label="Add my product photo"
        value={value}
        onChange={onChange}
        camera
      />
      <Note>
        Only you and our review team see this photo. The marker confirms ownership evidence, not product safety.
      </Note>
    </JournalCard>
  );
}
