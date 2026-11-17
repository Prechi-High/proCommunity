import { lazy, Suspense, useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";

import { HomeFeedTabs, type HomeFeedTab } from "./HomeFeedTabs";

const LivingFeed = lazy(() => import("./LivingFeed").then((m) => ({ default: m.LivingFeed })));

export function SocialHome() {
  const [tab, setTab] = useState<HomeFeedTab>("for-you");

  return (
    <View style={{ flex: 1, backgroundColor: "#F5ECEF" }}>
      <LinearGradient colors={["#3D0F15", "#5C2834", "rgba(92,40,52,0)"]} style={{ paddingBottom: 4 }}>
        <HomeFeedTabs active={tab} onChange={setTab} />
      </LinearGradient>
      <Suspense fallback={<ContentSkeleton rows={6} />}>
        <LivingFeed feedTab={tab} />
      </Suspense>
    </View>
  );
}