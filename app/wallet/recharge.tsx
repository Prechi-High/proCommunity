import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  ink,
} from "@/components/unmask/reference/ui";
export default function Recharge() {
  const r = useRouter();
  const [kind, setKind] = useState("Sparks");
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState(false);
  const thunder = kind === "Thunder Sparks";
  const price = Number(amount) * (thunder ? 1000 : 10);
  return (
    <UtilityPage
      title="Keep curiosity moving."
      sub="Add Sparks or Thunder Sparks to support investigations."
    >
      <Chips
        options={["Sparks", "Thunder Sparks"]}
        value={kind}
        onChange={(v) => {
          setKind(v);
          setAmount(v === "Sparks" ? "100" : "1");
        }}
      />
      <Heading>Choose a {thunder ? "Thunder Sparks" : "Sparks"} pack</Heading>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
      >
        {(thunder ? ["1", "5", "10"] : ["50", "100", "500", "1000"]).map(
          (n) => (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: amount === n }}
              accessibilityLabel={`${n} ${kind}, ₦${Number(n) * (thunder ? 1000 : 10)}`}
              onPress={() => setAmount(n)}
              style={{
                flexGrow: 1,
                flexBasis: "40%",
                padding: 18,
                gap: 10,
                borderWidth: 1,
                borderColor: amount === n ? ink.brand : ink.line,
                borderRadius: 12,
                backgroundColor: amount === n ? ink.tint : "white",
              }}
            >
              <Heading>
                {thunder ? "⚡" : "✦"} {Number(n).toLocaleString()}
              </Heading>
              <Copy>{kind}</Copy>
              <Copy>
                ₦{(Number(n) * (thunder ? 1000 : 10)).toLocaleString()}
              </Copy>
            </Pressable>
          ),
        )}
      </View>
      {!thunder ? (
        <Button
          quiet
          label="Or choose 1 Thunder Spark · ₦1,000"
          onPress={() => {
            setKind("Thunder Sparks");
            setAmount("1");
          }}
        />
      ) : null}
      <Heading>Order summary</Heading>
      <Card>
        <Copy>
          {amount} {kind}
        </Copy>
        <Heading>Total · ₦{price.toLocaleString()}</Heading>
        <Copy small>1 Thunder Spark = 100 Spark equivalents.</Copy>
      </Card>
      <Heading>Payment method</Heading>
      <Button
        quiet
        label="Choose payment method →"
        onPress={() => setMethod(!method)}
      />
      {method ? (
        <Notice>
          Card and bank-transfer checkout will appear here when a payment
          provider is connected. No payment details are collected.
        </Notice>
      ) : null}
      <Button
        disabled
        label="Continue to payment · coming soon"
        onPress={() => {}}
      />
      <Copy small>
        No automatic renewal. Recharge is not connected; no payment will be
        taken.
      </Copy>
      <Card>
        <Copy small>PAYMENT SCREEN PREVIEWS · No transaction</Copy>
        {["success", "pending", "failed"].map((state) => (
          <Button
            key={state}
            quiet
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
