import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import { signOutEverywhere } from "@/lib/auth";
const groups = [
  {
    title: "Account",
    rows: [
      [
        "Interests & optional context",
        "Update your private setup",
        "/onboarding/interests",
      ],
      ["Profile", "Manage your profile and preferences", "/profile/edit"],
      [
        "Sign-in and security",
        "Your sign-in details and account access",
        "/settings/details?section=security",
      ],
    ],
  },
  {
    title: "Privacy",
    rows: [
      [
        "Personal product context",
        "Control the context you choose to share",
        "/clarity-settings",
      ],
      [
        "Public profile visibility",
        "Manage what others can see",
        "/profile/edit",
      ],
      [
        "Data controls",
        "Manage data on this device",
        "/settings/details?section=data",
      ],
    ],
  },
  {
    title: "Notifications",
    rows: [
      [
        "Investigation updates",
        "Manage followed investigation updates",
        "/settings/details?section=notifications",
      ],
      ["Replies and follows", "View your community updates", "/notifications"],
      [
        "Offers notifications",
        "Availability and preferences",
        "/settings/details?section=offers",
      ],
    ],
  },
  {
    title: "Payments",
    rows: [
      [
        "Purchase history",
        "Past recharge purchases and receipts (₦)",
        "/wallet/purchases",
      ],
      [
        "Contributions",
        "Your recorded investigation support",
        "/wallet/history",
      ],
    ],
  },
  {
    title: "Support",
    rows: [
      ["Help and support", "Find answers or send a support request", "/help"],
    ],
  },
  {
    title: "About",
    rows: [
      [
        "Terms",
        "Terms of service availability",
        "/settings/details?section=terms",
      ],
      [
        "Privacy policy",
        "Privacy policy availability",
        "/settings/details?section=privacy",
      ],
    ],
  },
];
export default function Settings() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <UtilityPage title="Settings">
      {groups.map((g) => (
        <Card key={g.title}>
          <Heading>{g.title}</Heading>
          {g.rows.map(([label, sub, path]) => (
            <Card key={label}>
              <Button
                quiet
                label={`${label} →`}
                onPress={() => r.push(path as Href)}
              />
              <Copy small>{sub}</Copy>
            </Card>
          ))}
        </Card>
      ))}
      {error ? <Notice>{error}</Notice> : null}
      {uid ? (
        <Button
          quiet
          disabled={busy}
          label={busy ? "Signing out…" : "Sign out →"}
          onPress={() => {
            setBusy(true);
            void signOutEverywhere()
              .catch(() => setError("Could not sign out. Please retry."))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </UtilityPage>
  );
}
