import { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  TeamGate,
  TeamPage,
  useTeamAction,
  ActionResult,
} from "@/components/team/Page";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { money } from "@/lib/creator/api";
import { db } from "@/lib/clarity/api";
import * as api from "@/lib/team/api";
export default function Finance() {
  return (
    <TeamGate>
      <Content />
    </TeamGate>
  );
}
function Content() {
  const [tab, setTab] = useState("Creator payouts");
  const [creator, setCreator] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [funding, setFunding] = useState("Purchased support");
  const [fundingRef, setFundingRef] = useState("");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const action = useTeamAction();
  const creators = useQuery({
    queryKey: ["team", "creators"],
    queryFn: api.creators,
  });
  const earnings = useQuery({
    queryKey: ["team", "earnings"],
    queryFn: api.teamEarnings,
  });
  const payouts = useQuery({
    queryKey: ["team", "payouts"],
    queryFn: api.teamPayouts,
  });
  const contributions = useQuery({
    queryKey: ["team", "contributions"],
    queryFn: api.contributions,
  });
  const audit = useQuery({ queryKey: ["team", "audit"], queryFn: api.audit });
  const eligible = earnings.data?.filter((e) => e.status === "available") ?? [];
  const pending = earnings.data?.filter((e) => e.status === "pending") ?? [];
  const total = eligible
    .filter((e) => selected.includes(e.id) && e.creator_id === creator)
    .reduce((s, e) => s + e.amount_kobo, 0);
  const kobo = Math.round(Number(amount) * 100);
  return (
    <TeamPage title="Payments and payouts" tab="Operations">
      <Chips
        options={[
          "Purchases",
          "Contributions",
          "Creator payouts",
          "Exceptions",
        ]}
        value={tab}
        onChange={setTab}
      />
      <Notice>
        Payment-provider checkout and bank transfers are not connected. This
        workspace records verified financial activity; it does not move money.
      </Notice>
      <Busy
        loading={earnings.isLoading || payouts.isLoading || creators.isLoading}
        error={earnings.error || payouts.error || creators.error}
        retry={() => {
          void earnings.refetch();
          void payouts.refetch();
          void creators.refetch();
        }}
      />
      {tab === "Purchases" || tab === "Exceptions" ? (
        <Copy>
          No connected purchase or reconciliation records. Design previews are
          not transactions.
        </Copy>
      ) : tab === "Contributions" ? (
        <>
          <Busy loading={contributions.isLoading} error={contributions.error} />
          {contributions.data?.map((c) => (
            <Card key={c.id}>
              <Heading>
                {c.amount} {c.kind === "sparks" ? "Sparks" : "Thunder Sparks"}
              </Heading>
              <Copy small>
                {c.id} ·{" "}
                {new Date(c.created_at).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}
              </Copy>
            </Card>
          ))}
          {contributions.data?.length === 0 ? (
            <Copy>No contributions recorded.</Copy>
          ) : null}
        </>
      ) : (
        <>
          <Card>
            <Heading>Weekly payout review</Heading>
            <Copy>
              Available:{" "}
              {money(eligible.reduce((s, e) => s + e.amount_kobo, 0))}
            </Copy>
            <Copy>
              Pending: {money(pending.reduce((s, e) => s + e.amount_kobo, 0))}
            </Copy>
            <Copy small>
              Totals reflect up to 300 recent earnings records. No payout batch
              date is invented.
            </Copy>
          </Card>
          <Heading>Record creator earnings</Heading>
          <Copy>Select creator</Copy>
          {creators.data?.map((c) => (
            <Button
              key={c.user_id}
              quiet
              label={`${creator === c.user_id ? "●" : "○"} ${c.display_name}`}
              onPress={() => {
                setCreator(c.user_id);
                setSelected([]);
                setConfirm(false);
                setVerified(false);
              }}
            />
          ))}
          <Field
            label="Earning description"
            value={label}
            onChange={setLabel}
          />
          <Field label="Amount in naira" value={amount} onChange={setAmount} />
          <Chips
            options={[
              "Purchased support",
              "Founder subsidy",
              "Funded promotion",
            ]}
            value={funding}
            onChange={setFunding}
          />
          <Field
            label="Verified funding reference"
            value={fundingRef}
            onChange={setFundingRef}
          />
          <Copy small>
            Promotional units require a funded allowance before creating cash
            earnings. A reference is not payment verification.
          </Copy>
          <Button
            disabled={
              action.isPending ||
              !creator ||
              label.trim().length < 3 ||
              !/^\d+(\.\d{1,2})?$/.test(amount) ||
              !Number.isSafeInteger(kobo) ||
              kobo <= 0 ||
              fundingRef.trim().length < 5
            }
            label="Record pending earning"
            onPress={() =>
              action.mutate(() =>
                api.read(
                  db().from("unmask_creator_earnings").insert({
                    creator_id: creator,
                    label: label.trim(),
                    amount_kobo: kobo,
                    status: "pending",
                    funding_source: funding,
                    funding_reference: fundingRef.trim(),
                  }),
                ),
              )
            }
          />
          <Heading>Pending approval</Heading>
          {pending.map((e) => (
            <Card key={e.id}>
              <Heading>{e.label}</Heading>
              <Copy>
                {
                  creators.data?.find((c) => c.user_id === e.creator_id)
                    ?.display_name
                }{" "}
                · {money(e.amount_kobo)}
              </Copy>
              <Copy small>
                {e.funding_source || "Funding not recorded"} ·{" "}
                {e.funding_reference || "Reference missing"}
              </Copy>
              <Button
                quiet
                disabled={action.isPending || !e.funding_reference}
                label="Approve as available"
                onPress={() =>
                  action.mutate(() =>
                    api.read(
                      db()
                        .from("unmask_creator_earnings")
                        .update({ status: "available" })
                        .eq("id", e.id)
                        .eq("status", "pending"),
                    ),
                  )
                }
              />
            </Card>
          ))}
          <Heading>Review completed external payout</Heading>
          <Copy>Choose available earnings for the selected creator.</Copy>
          {eligible
            .filter((e) => e.creator_id === creator)
            .map((e) => (
              <Button
                key={e.id}
                quiet
                label={`${selected.includes(e.id) ? "☑" : "☐"} ${e.label} · ${money(e.amount_kobo)}`}
                onPress={() => {
                  setSelected(
                    selected.includes(e.id)
                      ? selected.filter((id) => id !== e.id)
                      : [...selected, e.id],
                  );
                  setConfirm(false);
                }}
              />
            ))}
          <Heading>Selected: {money(total)}</Heading>
          <Field
            label="External completed-transfer reference"
            value={reference}
            onChange={setReference}
          />
          <Field
            label="Receipt HTTPS URL (optional)"
            value={receipt}
            onChange={setReceipt}
          />
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Copy>I verified that this external payout completed.</Copy>
            </View>
            <Switch
              value={verified}
              onValueChange={setVerified}
              accessibilityLabel="Verified external payout completed"
            />
          </View>
          <Button
            disabled={
              action.isPending ||
              !verified ||
              total <= 0 ||
              reference.trim().length < 5
            }
            label="Review payout record"
            onPress={() => setConfirm(true)}
          />
          {confirm ? (
            <Card>
              <Copy>
                This records {money(total)} as paid and removes those earnings
                from availability. It does not send a bank transfer.
              </Copy>
              <Button
                disabled={action.isPending}
                label="Confirm completed payout record"
                onPress={() =>
                  action.mutate(async () => {
                    await api.recordPayout(
                      creator,
                      selected,
                      reference.trim(),
                      receipt.trim(),
                    );
                    setSelected([]);
                    setConfirm(false);
                    setVerified(false);
                  })
                }
              />
              <Button quiet label="Cancel" onPress={() => setConfirm(false)} />
            </Card>
          ) : null}
          <Heading>Payout history</Heading>
          {payouts.data?.map((p) => (
            <Card key={p.id}>
              <Heading>{money(p.amount_kobo)}</Heading>
              <Pill>Recorded paid</Pill>
              <Copy>{p.reference}</Copy>
              <Copy small>
                {new Date(p.paid_at).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}
              </Copy>
            </Card>
          ))}
        </>
      )}
      <Button
        quiet
        label="Audit log"
        onPress={() => setShowAudit(!showAudit)}
      />
      {showAudit ? (
        <>
          <Busy loading={audit.isLoading} error={audit.error} />
          {audit.data?.map((a) => (
            <Card key={a.id}>
              <Copy>{a.action}</Copy>
              <Copy small>
                {a.entity_id} ·{" "}
                {new Date(a.created_at).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}
              </Copy>
            </Card>
          ))}
        </>
      ) : null}
      <ActionResult action={action} />
    </TeamPage>
  );
}
