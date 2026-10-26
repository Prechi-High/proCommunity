import { useLocalSearchParams } from "expo-router";
import { TrackingWizard } from "@/components/tracking/TrackingWizard";
export default function AddProduct() {
  const { product, resumeGuest } = useLocalSearchParams<{
    product?: string;
    resumeGuest?: string;
  }>();
  return <TrackingWizard productId={product} resumeGuest={resumeGuest} />;
}
