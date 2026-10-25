import { useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  Notice,
  Pill,
  ink,
} from "@/components/unmask/reference/ui";
const states = {
  success: {
    icon: "✓",
    title: "Payment successful",
    body: "In the connected payment flow, verified payments add credits to your wallet.",
  },
  pending: {
    icon: "◷",
    title: "Payment pending",
    body: "Your balance will update after confirmation. Check the status before starting another payment.",
  },
  failed: {
    icon: "!",
    title: "Payment wasn’t completed",
    body: "No Sparks were added. If your bank shows a debit, check the transaction before trying again.",
  },
};
export default function Payment() {
  const p = useLocalSearchParams<{
    state: string;
    amount: string;
    kind: string;
  }>();
  const r = useRouter();
  const [notice, setNotice] = useState("");
  const state =
    p.state === "success" || p.state === "failed" ? p.state : "pending";
  const item = states[state];
  const n =
    p.amount && /^\d{1,6}$/.test(p.amount) && Number(p.amount) > 0
      ? Number(p.amount)
      : 100;
  const thunder = p.kind === "Thunder Sparks";
  return (
    <UtilityPage title={item.title}>
      <Notice>
        Design preview only. No payment was processed and no credits were added.
      </Notice>
      <View style={{ alignItems: "center", padding: 16, gap: 20 }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: ink.tint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 48, color: ink.brand }}>{item.icon}</Text>
        </View>
        <Copy>{item.body}</Copy>
      </View>
      <Card>
        <Heading>
          {n} {thunder ? "Thunder Sparks" : "Sparks"}
        </Heading>
        <Copy>Amount · ₦{(n * (thunder ? 1000 : 10)).toLocaleString()}</Copy>
        <Pill>{state} · preview</Pill>
        <Copy small>Reference: No transaction created</Copy>
      </Card>
      {notice ? <Notice>{notice}</Notice> : null}
      {state === "success" ? (
        <Button
          quiet
          label="View receipt"
          onPress={() =>
            setNotice(
              "A receipt is available only after a real, verified payment. This preview has no receipt.",
            )
          }
        />
      ) : (
        <Button
          label="Check payment status"
          onPress={() =>
            setNotice(
              "No live payment exists for this preview. Your wallet balance has not changed.",
            )
          }
        />
      )}
      <Button label="Return to wallet" onPress={() => r.replace("/wallet")} />
      {state === "failed" ? (
        <Button
          quiet
          label="Choose another payment method"
          onPress={() => r.replace("/wallet/recharge")}
        />
      ) : null}
      <Button quiet label="Contact support" onPress={() => r.push("/help")} />
    </UtilityPage>
  );
}
