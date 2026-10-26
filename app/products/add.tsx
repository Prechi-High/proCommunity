import { useLocalSearchParams } from "expo-router";
import { TrackingWizard } from "@/components/tracking/TrackingWizard";
export default function AddProduct() {
  const { product } = useLocalSearchParams<{ product?: string }>();
  return <TrackingWizard productId={product} />;
}
