import { useLocalSearchParams } from "expo-router";
import { TrackingWizard } from "@/components/tracking/TrackingWizard";
export default function UpdateJourney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TrackingWizard journeyId={id} />;
}
