import { useState } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { ChooseMoment } from "@/components/moment/ChooseMoment";
import { MomentCamera } from "@/components/moment/MomentCamera";
import { MomentComplete, type MomentContext } from "@/components/moment/MomentComplete";
import { UnmaskPreview } from "@/components/moment/UnmaskPreview";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { hapticSaved } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { useAppStore } from "@/lib/store";

type Step = "choose" | "camera" | "complete" | "preview";

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

  const pickKind = (k: MomentKind) => {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/moment" } } as Href);
      return;
    }
    setKind(k);
    setStep("camera");
  };

  const post = (destination: "post" | "story" | "both") => {
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
      destination,
      mediaKind,
      momentKind: kind,
      occasion: context.occasion,
      usageDuration: context.usageDuration,
      stickers: [config.title, context.routineTag].filter(Boolean) as string[],
    });
    hapticSaved("moment");
    router.replace("/" as Href);
  };

  if (step === "choose") {
    return <ChooseMoment onPick={pickKind} />;
  }

  if (step === "camera" && kind) {
    return (
      <View style={{ flex: 1 }}>
        <MomentCamera
          kind={kind}
          onClose={() => {
            if (mediaUri) setStep("complete");
            else {
              setKind(null);
              setStep("choose");
            }
          }}
          onShot={(uri, mk) => {
            setMediaUri(uri);
            setMediaKind(mk);
            setStep("complete");
          }}
          onAddRoutine={kind === "morning" ? () => setStep("complete") : undefined}
        />
      </View>
    );
  }

  if (step === "complete" && kind && mediaUri) {
    return (
      <MomentComplete
        kind={kind}
        mediaUri={mediaUri}
        mediaKind={mediaKind}
        onBack={() => setStep("camera")}
        onNext={(ctx) => {
          setContext(ctx);
          setStep("preview");
        }}
      />
    );
  }

  if (step === "preview" && kind && mediaUri) {
    return <UnmaskPreview kind={kind} mediaUri={mediaUri} context={context} onPost={post} />;
  }

  return <ChooseMoment onPick={pickKind} />;
}