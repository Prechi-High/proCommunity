import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemberGate } from "@/components/community";
import { requestProduct } from "@/lib/living/api";
import {
  Button,
  Copy,
  Field,
  Header,
  Heading,
  Notice,
  s,
} from "@/components/unmask/reference/ui";
export default function RequestProduct() {
  const r = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [name, setName] = useState(q || "");
  const [brand, setBrand] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { requireMember, gate } = useMemberGate();
  const send = async () => {
    setBusy(true);
    try {
      await requestProduct(name.trim(), brand.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={s.page}>
      <Header onBack={() => r.back()} />
      <ScrollView contentContainerStyle={s.content}>
        <Heading hero>
          {done ? "Request received" : "Request a product"}
        </Heading>
        {done ? (
          <Copy>
            We’ve saved your request. You can continue exploring other products.
          </Copy>
        ) : (
          <>
            <Copy>Tell us the exact product you’d like to investigate.</Copy>
            <Field
              value={name}
              onChangeText={setName}
              placeholder="Product name"
            />
            <Field
              value={brand}
              onChangeText={setBrand}
              placeholder="Brand (optional)"
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button
              label={busy ? "Submitting…" : "Submit request"}
              disabled={busy || !name.trim()}
              onPress={() => requireMember(() => void send())}
            />
          </>
        )}
      </ScrollView>
      {gate}
    </SafeAreaView>
  );
}
