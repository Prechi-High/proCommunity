import { useState } from "react";
import { useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Card,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
const faqs = [
  {
    q: "What does it mean to unmask a product?",
    a: "Unmask brings together user experiences, questions, evidence, and creator investigations to create clarity. It is not a product certification.",
  },
  {
    q: "How do Sparks and Thunder Sparks work?",
    a: "Sparks support investigations. One Spark costs ₦10; one Thunder Spark costs ₦1,000 and carries 100 Spark equivalents. Minimum support is 10 Sparks or 1 Thunder Spark.",
  },
  {
    q: "Can I recharge my wallet?",
    a: "Recharge payments are not connected yet. You can explore the wallet and recharge UI, but no payment is processed.",
  },
  {
    q: "Does support guarantee an investigation?",
    a: "No. Support helps the editorial team understand interest. Selection, creator assignment, and conclusions remain editorial decisions.",
  },
  {
    q: "Can I support privately?",
    a: "Yes. Public acknowledgment is off by default. Anonymous support counts toward totals without listing your profile as a public supporter.",
  },
  {
    q: "Can I withdraw Sparks?",
    a: "Member support credits are not a withdrawable cash balance. Creator earnings and payouts are a separate system.",
  },
  {
    q: "How do I correct or update my experience?",
    a: "Open your published experience and add a follow-up update. Keep the original context so readers can understand how your experience changed.",
  },
  {
    q: "What if my payment is pending or failed?",
    a: "Payment states currently exist as UI previews. Once payments are connected, balances must change only after verified payment confirmation. Never share card details or account passwords in a public post.",
  },
];
export default function Help() {
  const r = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const matches = faqs.filter((f) =>
    `${f.q} ${f.a}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <UtilityPage
      title="A little clarity, right here."
      sub="Answers about your account, support credits, and community."
    >
      <Field label="Search help" value={query} onChange={setQuery} />
      {matches.map((f) => (
        <Card key={f.q}>
          <Button
            quiet
            label={`${open === f.q ? "−" : "+"} ${f.q}`}
            onPress={() => setOpen(open === f.q ? null : f.q)}
          />
          {open === f.q ? <Copy>{f.a}</Copy> : null}
        </Card>
      ))}
      {matches.length === 0 ? (
        <Copy>
          No matching answers. Try “Sparks”, “payment”, or “experience”.
        </Copy>
      ) : null}
      <Card>
        <Heading>Need your contribution receipt?</Heading>
        <Copy>
          Your contribution history includes receipt IDs and investigation
          links.
        </Copy>
        <Button
          label="View contribution history"
          onPress={() => r.push("/wallet/history")}
        />
      </Card>
      <Notice>
        A private support contact channel has not been connected yet. Do not
        post payment or personal account details in Community.
      </Notice>
    </UtilityPage>
  );
}
