import { useState } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { ChooseMoment } from "@/components/moment/ChooseMoment";
import { MomentCamera } from "@/components/moment/MomentCamera";
import { MomentComplete, type MomentContext } from "@/components/moment/MomentComplete";
import { MomentShareScreen } from "@/components/moment/MomentShareScreen";
import { MomentStoryPreview } from "@/components/moment/MomentStoryPreview";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { hapticSaved } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { useAppStore } from "@/lib/store";

type Step = "choose" | "camera" | "setup" | "preview" | "share";

export default function Moment() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const display = useAppStore((s) => s.profile?.displayName) || "You";
  const add = useLocalMoments((s) => s.add);

  const [step, setStep] = useState<Step>("choose");
  const [kind, setKind] = useState<MomentKind | null>(null);
  const [mediaUri, setMediaUri] = useState("");
  const [mediaKind, setMediaKind] = useState<"photo" | "video">("photo");
  const [context, setContext] = useState<MomentContext>({});
  const [saveToJourney, setSaveToJourney] = useState(true);
  const [openProductOnSetup, setOpenProductOnSetup] = useState(false);

  const pickKind = (k: MomentKind) => {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/moment" } } as Href);
      return;
    }
    setKind(k);
    setStep("camera");
  };

  const post = () => {
    if (!kind || !mediaUri) return;
    const config = momentConfig(kind);
    const caption =
      context.experience?.trim() ||
      [config.title, context.occasion, context.productName].filter(Boolean).join(" · ") ||
      config.tagline;

    add({
      photo: mediaUri,
      caption,
      author: display,
      productName: context.productName,
      timelineId: context.timelineId,
      timelineLabel: context.timelineLabel,
      destination: "story",
      mediaKind,
      momentKind: kind,
      occasion: context.occasion,
      usageDuration: context.usageDuration,
      routineTags: context.routineTags,
      stickers: [`${config.title} ${config.emoji}`, context.occasion].filter(Boolean) as string[],
    });
    hapticSaved("moment");
    router.replace("/community" as Href);
  };

  if (step === "choose") {
    return (
      <ChooseMoment
        onPick={pickKind}
        onProductStory={() => {
          if (!uid) {
            router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/contribute" } } as Href);
            return;
          }
          router.push("/contribute" as Href);
        }}
      />
    );
  }

  if (step === "camera" && kind) {
    return (
      <View style={{ flex: 1 }}>
        <MomentCamera
          kind={kind}
          onClose={() => {
            if (mediaUri) setStep("setup");
            else router.replace("/" as Href);
          }}
          onAddProduct={() => {
            setOpenProductOnSetup(true);
            if (mediaUri) setStep("setup");
          }}
          onShot={(uri, mk) => {
            setMediaUri(uri);
            setMediaKind(mk);
            setStep("setup");
          }}
        />
      </View>
    );
  }

  if (step === "setup" && kind && mediaUri) {
    return (
      <MomentComplete
        kind={kind}
        mediaUri={mediaUri}
        mediaKind={mediaKind}
        initialOpenProduct={openProductOnSetup}
        onBack={() => setStep("camera")}
        onNext={(ctx) => {
          setContext(ctx);
          setOpenProductOnSetup(false);
          setStep("preview");
        }}
      />
    );
  }

  if (step === "preview" && kind && mediaUri) {
    return (
      <MomentStoryPreview
        kind={kind}
        mediaUri={mediaUri}
        mediaKind={mediaKind}
        context={context}
        onBack={() => setStep("setup")}
        onNext={() => setStep("share")}
      />
    );
  }

  if (step === "share" && kind && mediaUri) {
    return (
      <MomentShareScreen
        kind={kind}
        mediaUri={mediaUri}
        context={context}
        onBack={() => setStep("preview")}
        onPublish={post}
        saveToJourney={saveToJourney}
        onToggleJourney={setSaveToJourney}
      />
    );
  }

  return (
    <ChooseMoment
      onPick={pickKind}
      onProductStory={() => router.push("/contribute" as Href)}
    />
  );
}