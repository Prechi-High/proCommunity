import { useState } from "react";
import { useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
export default function Recharge() {
  const r = useRouter();
  const [kind, setKind] = useState("Sparks");
  const [amount, setAmount] = useState("50");
  const thunder = kind === "Thunder Sparks";
  const price = Number(amount) * (thunder ? 1000 : 10);
  return (
    <UtilityPage
      title="Keep your curiosity moving."
      sub="Choose the support credits that work for you."
    >
      <Chips
        options={["Sparks", "Thunder Sparks"]}
        value={kind}
        onChange={(v) => {
          setKind(v);
          setAmount(v === "Sparks" ? "50" : "1");
        }}
      />
      <Chips
        options={thunder ? ["1", "5", "10"] : ["50", "100", "500", "1000"]}
        value={amount}
        onChange={setAmount}
      />
      <Card>
        <Heading>
          {amount} {kind}
        </Heading>
        <Heading hero>₦{price.toLocaleString()}</Heading>
        <Copy>
          {thunder
            ? "One Thunder Spark carries 100 Spark equivalents."
            : "One Spark = ₦10. Minimum contribution = 10 Sparks."}
        </Copy>
        <Copy>Credits are added only after payment is verified.</Copy>
      </Card>
      <Notice>Recharge is not available yet. No payment will be taken.</Notice>
      <Button disabled label="Payment coming soon" onPress={() => {}} />
      <Button
        quiet
        label="Back to wallet"
        onPress={() => r.replace("/wallet")}
      />
      <Card>
        <Copy small>PAYMENT SCREEN PREVIEWS · No transaction</Copy>
        <Copy small>
          Preview the planned payment states. These do not change your balance.
        </Copy>
        {["success", "pending", "failed"].map((state) => (
          <Button
            quiet
            key={state}
            label={`Preview ${state}`}
            onPress={() =>
              r.push({
                pathname: "/wallet/payment",
                params: { state, amount, kind },
              })
            }
          />
        ))}
      </Card>
    </UtilityPage>
  );
}
