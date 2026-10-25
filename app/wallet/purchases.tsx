import { useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { Button, Card, Copy, Heading } from "@/components/unmask/reference/ui";
export default function Purchases() {
  const r = useRouter();
  return (
    <UtilityPage
      title="Purchase history"
      sub="Recharge payments and verified receipts."
    >
      <Card>
        <Heading>No recharge purchases yet.</Heading>
        <Copy>
          Payment processing is not connected. Payment previews do not create
          purchases or receipts.
        </Copy>
        <Button label="View wallet" onPress={() => r.replace("/wallet")} />
        <Button
          quiet
          label="View contribution history"
          onPress={() => r.push("/wallet/history")}
        />
      </Card>
    </UtilityPage>
  );
}
