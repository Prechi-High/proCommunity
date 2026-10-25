import { useEffect } from "react";
import { currentSignIn } from "@/lib/auth";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { EntryPage, EntryTitle } from "@/components/entry/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  ink,
} from "@/components/unmask/reference/ui";
import {
  BookOpen,
  ChatCircle,
  Play,
  MagnifyingGlass,
} from "@/components/icons";
import { markEntrySeen } from "@/lib/entry/api";
export default function Welcome() {
  const r = useRouter();
  useEffect(() => {
    let active = true;
    void currentSignIn()
      .then((session) => {
        if (active && session) r.replace("/(tabs)");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [r]);
  const go = async (path: "/sign-up" | "/(auth)/sign-in" | "/(tabs)") => {
    await markEntrySeen().catch(() => undefined);
    r.replace(path);
  };
  return (
    <EntryPage>
      <EntryTitle>Welcome to Unmask.</EntryTitle>
      <Heading>Know before you buy.</Heading>
      <Copy muted>
        Real experiences. Thoughtful questions. Clarity, together.
      </Copy>
      <View
        style={{
          backgroundColor: ink.tint,
          borderRadius: 28,
          padding: 30,
          alignItems: "center",
          gap: 16,
        }}
      >
        <MagnifyingGlass size={72} color={ink.brand} />
        <Heading>Every product has a story.</Heading>
        <Copy>What worked? What changed? What still needs an answer?</Copy>
      </View>
      {[
        {
          Icon: BookOpen,
          title: "Learn from real experiences",
          body: "Reviews, photos and follow-ups from people who have used the product.",
        },
        {
          Icon: ChatCircle,
          title: "Ask fellow Unmaskers",
          body: "Bring your questions. Learn from different experiences.",
        },
        {
          Icon: Play,
          title: "Follow creator investigations",
          body: "Watch Unmask Creators go deeper on the products that matter.",
        },
      ].map(({ Icon, title, body }) => (
        <Card key={title}>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Icon size={32} color={ink.brand} />
            <View style={{ flex: 1, gap: 5 }}>
              <Heading>{title}</Heading>
              <Copy muted>{body}</Copy>
            </View>
          </View>
        </Card>
      ))}
      <Button label="Join Unmask →" onPress={() => void go("/sign-up")} />
      <Button
        quiet
        label="Sign in"
        onPress={() => void go("/(auth)/sign-in")}
      />
      <Button quiet label="Explore first" onPress={() => void go("/(tabs)")} />
    </EntryPage>
  );
}
