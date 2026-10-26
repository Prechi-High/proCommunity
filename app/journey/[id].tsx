import { useLocalSearchParams } from "expo-router";
import { TimelineView } from "@/components/tracking/TimelineView";
export default function Journey() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TimelineView id={id} />;
}
