import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  Busy,
  ink,
} from "@/components/unmask/reference/ui";
import { wallet } from "@/lib/investigations/api";
import { history } from "@/lib/utilities/api";
import { useAppStore } from "@/lib/store";
export default function Wallet() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ["spark-wallet", uid],
    queryFn: wallet,
    enabled: !!uid,
  });
  const h = useQuery({
    queryKey: ["spark-history", uid],
    queryFn: history,
    enabled: !!uid,
  });
  return (
    <UtilityPage
      title="Your Sparks"
      sub="Support the questions you care about on Unmask."
    >
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          {q.isSuccess ? (
            <View style={{ flexDirection: "row", gap: 12 }}>
              {[
                ["✦", "Sparks", q.data?.sparks ?? 0],
                ["⚡", "Thunder Sparks", q.data?.thunder ?? 0],
              ].map(([icon, label, value], i) => (
                <View
                  key={String(label)}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: i ? "#ECD8AD" : "#E6D5DB",
                    backgroundColor: i ? "#FFFBF2" : ink.tint,
                    borderRadius: 14,
                    padding: 18,
                    gap: 8,
                  }}
                >
                  <Heading>
                    {icon} {Number(value).toLocaleString()}
                  </Heading>
                  <Copy>{label}</Copy>
                  <Copy small>Your available balance</Copy>
                </View>
              ))}
            </View>
          ) : null}
          <Button
            label="✦ Recharge"
            onPress={() => r.push("/wallet/recharge")}
          />
        </>
      )}
      <Card>
        <Copy>1 Spark = ₦10</Copy>
        <Copy>1 Thunder Spark = ₦1,000, equivalent to 100 Sparks.</Copy>
        <Copy small>
          Support credits are not withdrawable cash. Minimum contribution: 10
          Sparks or 1 Thunder Spark.
        </Copy>
      </Card>
      <Heading>Recent activity</Heading>
      <Button
        quiet
        label="See all contributions →"
        onPress={() => r.push("/wallet/history")}
      />
      {uid ? (
        <>
          <Busy
            loading={h.isLoading}
            error={h.error}
            retry={() => void h.refetch()}
          />
          {h.data?.slice(0, 3).map((e) => (
            <Card key={e.id}>
              <Heading>Supported an investigation</Heading>
              <Copy>{e.unmask_investigations?.title || "Investigation"}</Copy>
              <Copy>
                −{e.amount} {e.kind === "sparks" ? "Sparks" : "Thunder Sparks"}
              </Copy>
              <Copy small>{new Date(e.created_at).toLocaleString()}</Copy>
              <Button
                quiet
                label="View investigation"
                onPress={() =>
                  r.push(`/investigation/${e.investigation_id}` as Href)
                }
              />
            </Card>
          ))}
          {h.data?.length === 0 ? (
            <Copy>
              No contributions yet. Your recorded support will appear here.
            </Copy>
          ) : null}
        </>
      ) : (
        <Copy>Sign in to view private wallet activity.</Copy>
      )}
      <Button
        quiet
        label="Purchase history →"
        onPress={() => r.push("/wallet/purchases")}
      />
      <Button
        quiet
        label="Contributions →"
        onPress={() => r.push("/wallet/history")}
      />
    </UtilityPage>
  );
}
