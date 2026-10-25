import { useEffect, useState } from "react";
import { TextInput } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { z } from "zod";
import { EntryPage, EntryTitle } from "./Page";
import {
  Button,
  Copy,
  Busy,
  s,
  Notice,
} from "@/components/unmask/reference/ui";
import { requestEmailCode } from "@/lib/services/auth/requestEmailCode";
import { currentSignIn } from "@/lib/auth";
import {
  safeReturn,
  setup,
  rememberName,
  markEntrySeen,
} from "@/lib/entry/api";
export default function AuthForm({ join = false }: { join?: boolean }) {
  const r = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const ret = safeReturn(params.returnTo);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    void currentSignIn()
      .then(async (session) => {
        if (session) {
          const p = await setup();
          if (active)
            r.replace(
              (p?.onboarding_completed_at
                ? ret || "/(tabs)"
                : "/onboarding/interests" +
                  (ret ? "?returnTo=" + encodeURIComponent(ret) : "")) as Href,
            );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [r, ret]);
  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const clean = z
        .string()
        .email()
        .max(320)
        .parse(email.trim().toLowerCase());
      await requestEmailCode(clean);
      if (join) rememberName(clean, name.trim());
      const q = new URLSearchParams({ email: clean });
      if (ret) q.set("returnTo", ret);
      r.push(("/verify-email?" + q.toString()) as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your code.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <EntryPage back>
      <EntryTitle>
        {join ? "Become an Unmasker." : "Good to have you back."}
      </EntryTitle>
      <Copy muted>
        {join
          ? "Join the conversation. Share what you discover."
          : "Sign in to continue to the Unmask community — clarity from real people and real conversations."}
      </Copy>
      {checking ? (
        <Busy loading />
      ) : (
        <>
          {join ? (
            <>
              <Copy>Display name</Copy>
              <TextInput
                accessibilityLabel="Display name"
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                maxLength={40}
                style={s.input}
              />
            </>
          ) : null}
          <Copy>Email address</Copy>
          <TextInput
            accessibilityLabel="Email address"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={s.input}
          />
          <Copy small>
            We’ll email you a six-digit code. No password needed. New email
            addresses create an account after verification.
          </Copy>
          <Button
            label={
              busy
                ? "Sending code…"
                : join
                  ? "Create account →"
                  : "Send sign-in code →"
            }
            disabled={
              busy ||
              !z.string().email().max(320).safeParse(email.trim()).success ||
              (join && name.trim().length < 2)
            }
            onPress={() => void send()}
          />
          <Button
            quiet
            label="Continue with Google · Coming soon"
            disabled
            onPress={() => undefined}
          />
          <Button
            quiet
            label={
              join ? "Already a member? Sign in" : "New here? Join Unmask →"
            }
            onPress={() =>
              r.replace({
                pathname: join ? "/(auth)/sign-in" : "/sign-up",
                params: ret ? { returnTo: ret } : {},
              } as Href)
            }
          />
          <Button
            quiet
            label="Explore first"
            onPress={() => {
              void markEntrySeen().catch(() => undefined);
              r.replace("/(tabs)");
            }}
          />
          <Copy small>
            Your email stays private. Your display name appears with
            contributions you choose to publish.
          </Copy>
          <Button
            quiet
            label="Terms of service"
            onPress={() => r.push("/settings/details?section=terms")}
          />
          <Button
            quiet
            label="Privacy policy"
            onPress={() => r.push("/settings/details?section=privacy")}
          />
        </>
      )}
      {error ? <Notice>{error}</Notice> : null}
    </EntryPage>
  );
}
