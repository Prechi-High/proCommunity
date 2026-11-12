import { useEffect, useRef, useState } from "react";
import { Image, PanResponder, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";

import { X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { voteMoment } from "@/lib/social/api";
import { sampleMark, type RailPerson } from "@/lib/social/model";
import { useAppStore } from "@/lib/store";

import { Face, portraitSource } from "./media";

const PHOTO_MS = 5200;

export function StoryViewer({
  people,
  startId,
  onSeen,
  onClose,
}: {
  people: RailPerson[];
  startId: string;
  onSeen: (id: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const uid = useAppStore((state) => state.profile?.id);
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const initial = Math.max(0, people.findIndex((person) => person.authorId === startId));
  const [personIndex, setPersonIndex] = useState(initial);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [choice, setChoice] = useState<"a" | "b" | null>(null);
  const downAt = useRef(0);
  const swiped = useRef(false);
  const person = people[personIndex];
  const moment = person?.moments[frame];
  const stepRef = useRef<(direction: number) => void>(() => undefined);

  const personStep = useRef<(direction: number) => void>(() => undefined);
  personStep.current = (direction: number) => {
    const nextPerson = personIndex + direction;
    if (nextPerson >= 0 && nextPerson < people.length) {
      setPersonIndex(nextPerson);
      setFrame(direction < 0 ? Math.max(0, people[nextPerson].moments.length - 1) : 0);
      return;
    }
    if (direction > 0) onClose();
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 22 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx <= -48) {
          swiped.current = true;
          personStep.current(1);
        } else if (gesture.dx >= 48) {
          swiped.current = true;
          personStep.current(-1);
        }
      },
    }),
  ).current;

  stepRef.current = (direction: number) => {
    if (!person) return;
    const nextFrame = frame + direction;
    if (nextFrame >= 0 && nextFrame < person.moments.length) {
      setFrame(nextFrame);
      return;
    }
    const nextPerson = personIndex + direction;
    if (nextPerson >= 0 && nextPerson < people.length) {
      setPersonIndex(nextPerson);
      setFrame(direction < 0 ? Math.max(0, people[nextPerson].moments.length - 1) : 0);
      return;
    }
    if (direction > 0) onClose();
  };

  useEffect(() => {
    setChoice(null);
    setProgress(0);
  }, [personIndex, frame]);

  useEffect(() => {
    if (moment) onSeen(moment.id);
  }, [moment?.id, onSeen]);

  useEffect(() => {
    if (!moment || paused || reduce) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const next = (Date.now() - started) / PHOTO_MS;
      if (next >= 1) {
        clearInterval(timer);
        stepRef.current(1);
      } else setProgress(next);
    }, 40);
    return () => clearInterval(timer);
  }, [moment?.id, paused, reduce]);

  if (!person || !moment) return null;
  const mark = sampleMark(moment);
  const openAttach = () => {
    if (!moment.attach) return;
    hapticSelect();
    onClose();
    if (moment.sample || moment.attach.kind === "card") {
      router.push(`/member/${moment.authorId}` as Href);
      return;
    }
    if (moment.attach.kind === "timeline") router.push(`/journey/${moment.attach.id}` as Href);
    else router.push(`/products/item/${moment.attach.id}` as Href);
  };

  return (
    <View style={{ width, height, backgroundColor: "#140E10" }} {...pan.panHandlers}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={`${person.author}. ${moment.caption || "Story"}. Tap the left side for the previous story, the right side for the next. Hold to pause.`}
        onPressIn={() => {
          downAt.current = Date.now();
          setPaused(true);
        }}
        onPressOut={(event) => {
          const held = Date.now() - downAt.current;
          setPaused(false);
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          if (held > 240) return;
          const x = event.nativeEvent.locationX;
          stepRef.current(x < width * 0.33 ? -1 : 1);
        }}
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: "row", gap: 4, paddingLeft: 12, paddingRight: 64, paddingTop: 14 }}>
          {person.moments.map((item, index) => (
            <View key={item.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
              <View
                style={{
                  width: index < frame ? "100%" : index === frame ? `${Math.round(progress * 100)}%` : "0%",
                  height: "100%",
                  backgroundColor: "#FFFFFF",
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 28, overflow: "hidden", backgroundColor: "#1C1416" }}>
          {moment.mediaKind === "video" && typeof moment.media === "object" ? (
            <Video
              source={{ uri: moment.media.uri }}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!paused}
              isLooping
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Image source={portraitSource(moment.media)} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close story"
        onPress={onClose}
        hitSlop={10}
        style={{ position: "absolute", top: 28, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(20,14,16,0.72)", alignItems: "center", justifyContent: "center" }}
      >
        <X size={18} color="#FFFFFF" weight="bold" />
      </Pressable>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 12, backgroundColor: "#140E10" }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${person.author} profile`}
          onPress={() => {
            onClose();
            router.push(`/member/${person.authorId}` as Href);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Face source={person.avatar} name={person.author} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#F7F1EA" }}>{person.author}</Text>
            {mark ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#F0CF69" }}>Sample · imagined</Text> : null}
          </View>
        </Pressable>
        {moment.caption ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 18, lineHeight: 25, color: "#F7F1EA" }}>{moment.caption}</Text>
        ) : null}
        {moment.poll ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["a", "b"] as const).map((key) => {
              const selected = choice === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    hapticSelect();
                    setChoice(key);
                    if (!moment.sample && uid) void voteMoment(moment.id, key).catch(() => undefined);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? "#F0CF69" : "#2A2224",
                  }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: selected ? "#1C1917" : "#F7F1EA" }}>
                    {moment.poll?.[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {moment.attach ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${moment.attach.label}`}
            onPress={openAttach}
            style={{ minHeight: 52, borderRadius: 18, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "#F7F1EA" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#3D0F15" }}>{moment.attach.label}</Text>
            {moment.attach.detail ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "#5C534F" }}>{moment.attach.detail}</Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
