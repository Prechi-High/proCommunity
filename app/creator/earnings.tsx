import { useState } from "react";
import { Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { CreatorGate } from "@/components/creator/Gate";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/creator/api";
export default function Earnings() {
  return (
    <CreatorGate>
      <Content />
    </CreatorGate>
  );
}
function Content() {
  const uid = useAppStore((s) => s.profile!.id);
  const r = useRouter();
  const [notice, setNotice] = useState("");
  const earnings = useQuery({
    queryKey: ["creator-earnings", uid],
    queryFn: api.earnings,
  });
  const payouts = useQuery({
    queryKey: ["creator-payouts", uid],
    queryFn: api.payouts,
  });
  const settings = useQuery({
    queryKey: ["creator-payout-settings", uid],
    queryFn: api.payoutSettings,
  });
  const sum = (status: string) =>
    (earnings.data ?? [])
      .filter((e) => e.status === status)
      .reduce((total, e) => total + e.amount_kobo, 0);
  const paid = (payouts.data ?? []).reduce(
    (total, p) => total + p.amount_kobo,
    0,
  );
  return (
    <UtilityPage
      title="Your work, your earnings."
      sub="PRIVATE CREATOR WORKSPACE · Amounts in naira."
    >
      <Busy
        loading={earnings.isLoading || payouts.isLoading || settings.isLoading}
        error={earnings.error || payouts.error || settings.error}
        retry={() => {
          void earnings.refetch();
          void payouts.refetch();
          void settings.refetch();
        }}
      />
      {earnings.isSuccess && payouts.isSuccess ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[
            ["Available for next payout", sum("available")],
            ["Pending approval", sum("pending")],
            ["Paid to date", paid],
          ].map(([label, amount]) => (
            <View key={String(label)} style={{ flexGrow: 1, flexBasis: 170 }}>
              <Card>
                <Copy>{label}</Copy>
                <Heading>{api.money(Number(amount))}</Heading>
              </Card>
            </View>
          ))}
        </View>
      ) : null}
      <Copy small>
        Only recorded earnings are shown. Rates and eligibility depend on your
        creator agreement; support totals do not automatically become your
        earnings.
      </Copy>
      <Card>
        <Heading>Weekly payout schedule</Heading>
        <Copy>
          {settings.data?.next_payout_on
            ? `Next recorded payout date: ${new Date(settings.data.next_payout_on + "T12:00:00+01:00").toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}`
            : "No payout date has been recorded yet."}
        </Copy>
        <Copy small>Automated transfers are not connected.</Copy>
      </Card>
      <Card>
        <Heading>Payout method</Heading>
        <Copy>
          {settings.data?.last_four
            ? `${settings.data.bank_name || "Bank account"} ending ${settings.data.last_four}`
            : "No payout method recorded."}
        </Copy>
        <Button
          quiet
          label="Manage payout method"
          onPress={() =>
            setNotice(
              "Payout-provider setup is not connected yet. Contact Unmask through private support to coordinate payout details. Do not post bank details publicly.",
            )
          }
        />
        <Button
          quiet
          label="Contact private support"
          onPress={() => r.push("/help")}
        />
      </Card>
      {notice ? <Notice>{notice}</Notice> : null}
      <Heading>Earnings</Heading>
      {earnings.data?.map((e) => (
        <Card key={e.id}>
          <Heading>{e.label}</Heading>
          <Copy>{api.money(e.amount_kobo)}</Copy>
          <Pill>{e.status}</Pill>
          <Copy small>
            {new Date(e.created_at).toLocaleDateString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
          </Copy>
          {e.investigation_id ? (
            <Button
              quiet
              label="View investigation"
              onPress={() =>
                r.push(`/investigation/${e.investigation_id}` as Href)
              }
            />
          ) : null}
        </Card>
      ))}
      {earnings.data?.length === 0 ? (
        <Copy>No earnings have been recorded yet.</Copy>
      ) : null}
      <Heading>Payout history</Heading>
      {payouts.data?.map((p) => (
        <Card key={p.id}>
          <Heading>{api.money(p.amount_kobo)}</Heading>
          <Copy>
            Paid ·{" "}
            {new Date(p.paid_at).toLocaleDateString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
          </Copy>
          <Copy small>Reference: {p.reference}</Copy>
          {p.receipt_url ? (
            <Button
              quiet
              label="View receipt →"
              onPress={() =>
                void Linking.openURL(p.receipt_url!).catch(() =>
                  setNotice("Could not open this receipt."),
                )
              }
            />
          ) : (
            <Copy small>No receipt link has been attached.</Copy>
          )}
        </Card>
      ))}
      {payouts.data?.length === 0 ? (
        <Copy>No payouts recorded yet.</Copy>
      ) : null}
    </UtilityPage>
  );
}
