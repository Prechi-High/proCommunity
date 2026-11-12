import { Redirect, type Href } from "expo-router";

import { PausedLayer } from "@/components/movement/PausedLayer";
import { features } from "@/lib/features";

export default function InvestigationsRedirect() {
  if (!features.ultraUnmask) return <PausedLayer surface="ultra" />;
  return <Redirect href={"/ultra-unmask" as Href} />;
}
