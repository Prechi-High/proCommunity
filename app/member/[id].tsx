import { useLocalSearchParams } from "expo-router";
import { PublicProfile } from "@/components/profiles/PublicProfile";
export default function Member() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PublicProfile key={id} id={id} />;
}
