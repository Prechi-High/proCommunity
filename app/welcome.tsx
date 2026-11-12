import { useEffect } from "react";
import { useRouter } from "expo-router";
import { MovementHome } from "@/components/movement/MovementHome";
import { currentSignIn } from "@/lib/auth";

export default function Welcome() {
  const r = useRouter();
  useEffect(() => {
    let active = true;
    void currentSignIn()
      .then((s) => {
        if (active && s) r.replace("/(tabs)");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [r]);
  return <MovementHome />;
}
