import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useRef } from "react";
import { View } from "react-native";
import { sendSupport } from "@/lib/utilities/api";
import { useAppStore } from "@/lib/store";
import { Chips } from "@/components/unmask/reference/ui";
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
    q: "How are creators assigned?",
    a: "Unmask’s editorial team assigns creators. Requests for a particular creator are not available yet. Creator status does not verify professional credentials.",
  },
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
  const { assignment } = useLocalSearchParams<{ assignment?: string }>();
  const [query, setQuery] = useState("");
  const uid = useAppStore((s) => s.profile?.id);
  const [topic, setTopic] = useState("All");
  const [subject, setSubject] = useState("Payment question");
  const [reference, setReference] = useState(assignment || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");

  const [open, setOpen] = useState<string | null>(null);
  const matches = faqs.filter((f) =>
    `${f.q} ${f.a}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <UtilityPage
      title="How can we help?"
      sub="Search for help articles or choose a topic below."
    >
      <Field label="Search help" value={query} onChange={setQuery} />
      <Heading>Browse by topic</Heading>
      <Chips
        options={[
          "All",
          "Sparks and payments",
          "Investigations",
          "Experiences and privacy",
          "Creator accounts",
        ]}
        value={topic}
        onChange={(v) => {
          setTopic(v);
          setQuery(
            v === "All"
              ? ""
              : v === "Sparks and payments"
                ? "Spark"
                : v === "Experiences and privacy"
                  ? "experience"
                  : v === "Creator accounts"
                    ? "creator"
                    : "investigation",
          );
        }}
      />
      <Heading>Frequently asked questions</Heading>
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
      <Heading>Contact support</Heading>
      <Copy>
        Send a private request. Do not include passwords, card PINs or OTPs.
      </Copy>
      <Card>
        <Chips
          options={[
            "Payment question",
            "Investigation question",
            "Account & privacy",
            "Other",
          ]}
          value={subject}
          onChange={setSubject}
        />
        <Field
          label="Transaction reference (optional)"
          value={reference}
          onChange={setReference}
        />
        <Field
          label="Message"
          value={message}
          onChange={setMessage}
          multiline
        />
        <Copy small>{message.length}/500 characters</Copy>
        {ticket ? <Notice>Request saved. Reference: {ticket}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        <Button
          disabled={
            busy ||
            (!!uid &&
              (message.trim().length < 10 ||
                message.length > 500 ||
                reference.length > 100))
          }
          label={
            !uid
              ? "Sign in to contact support"
              : busy
                ? "Saving request…"
                : "Send support request"
          }
          onPress={() => {
            if (!uid) {
              r.push("/(auth)/sign-in");
              return;
            }
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError("");
            void sendSupport(subject, reference.trim(), message.trim())
              .then((id) => {
                setTicket(id);
                setMessage("");
                setReference("");
              })
              .catch(() =>
                setError("Could not save your request. Please retry."),
              )
              .finally(() => {
                lock.current = false;
                setBusy(false);
              });
          }}
        />
      </Card>
    </UtilityPage>
  );
}
