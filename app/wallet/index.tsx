import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  Busy,
  Pill,
} from "@/components/unmask/reference/ui";
import { wallet } from "@/lib/investigations/api";
import { useAppStore } from "@/lib/store";
export default function Wallet() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ["spark-wallet", uid],
    queryFn: wallet,
    enabled: !!uid,
  });
  return (
    <UtilityPage
      title="A little Spark. More clarity."
      sub="Your support helps bring community questions into focus."
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
            <>
              <Card>
                <Pill>Spark balance</Pill>
                <Heading hero>
                  {(q.data?.sparks ?? 0).toLocaleString()} ✦
                </Heading>
                <Copy>
                  ₦{((q.data?.sparks ?? 0) * 10).toLocaleString()} purchase
                  equivalent
                </Copy>
              </Card>
              <Card>
                <Pill>Thunder Spark balance</Pill>
                <Heading>{q.data?.thunder ?? 0} ⚡</Heading>
                <Copy>1 Thunder Spark = 100 Sparks = ₦1,000</Copy>
              </Card>
            </>
          ) : null}
          <Button
            label="Recharge wallet"
            onPress={() => r.push("/wallet/recharge")}
          />
          <Button
            quiet
            label="Contribution history"
            onPress={() => r.push("/wallet/history")}
          />
        </>
      )}
      <Card>
        <Heading>Support the question. Keep the answer independent.</Heading>
        <Copy>
          Minimum support: 10 Sparks or 1 Thunder Spark. Support does not
          guarantee selection or a particular finding.
        </Copy>
        <Copy small>
          These are support credits, not a cash balance for withdrawal.
        </Copy>
      </Card>
      <Button
        quiet
        label="Explore investigations"
        onPress={() => r.push("/investigation")}
      />
    </UtilityPage>
  );
}
