import { useLocalSearchParams, useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
const states = {
  success: {
    icon: "✓",
    title: "Payment successful",
    body: "Once your payment is verified, your credits will be available in your wallet.",
  },
  pending: {
    icon: "◷",
    title: "Payment pending",
    body: "Payment verification may take a moment. Do not pay again while confirmation is pending.",
  },
  failed: {
    icon: "!",
    title: "Payment unsuccessful",
    body: "No credits have been added. In the connected payment flow, you can check the transaction before trying again.",
  },
};
export default function Payment() {
  const p = useLocalSearchParams<{
    state: string;
    amount: string;
    kind: string;
  }>();
  const r = useRouter();
  const state =
    p.state === "success" || p.state === "failed" ? p.state : "pending";
  const item = states[state];
  return (
    <UtilityPage title={item.title}>
      <Notice>
        UI preview only. No payment was processed and no credits were added.
      </Notice>
      <Card>
        <Heading hero>{item.icon}</Heading>
        <Pill>{state}</Pill>
        <Heading>
          {p.amount && /^\d{1,6}$/.test(p.amount) ? p.amount : "50"}{" "}
          {p.kind === "Thunder Sparks" ? "Thunder Sparks" : "Sparks"}
        </Heading>
        <Copy>{item.body}</Copy>
      </Card>
      <Button label="View wallet" onPress={() => r.replace("/wallet")} />
      <Button
        quiet
        label="Back to recharge"
        onPress={() => r.replace("/wallet/recharge")}
      />
      <Button quiet label="Payment help" onPress={() => r.push("/help")} />
    </UtilityPage>
  );
}
