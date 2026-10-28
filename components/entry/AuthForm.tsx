import { useEffect, useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { z } from "zod";
import { EntryPage, EntryTitle } from "./Page";
import {
  ActionButton,
  ContentSkeleton,
  StatusMessage,
} from "@/components/unmask-ui";
import { requestEmailCode } from "@/lib/services/auth/requestEmailCode";
import { currentSignIn } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { safeReturn, setup, markEntrySeen } from "@/lib/entry/api";
import { colors, fonts } from "@/constants/theme";
const field = {
  fontFamily: fonts.regular,
  fontSize: 17,
  padding: 17,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 17,
  color: colors.ink,
  backgroundColor: "#FAF8F6",
};
const copy = {
  fontFamily: fonts.regular,
  fontSize: 15,
  lineHeight: 23,
  color: colors.inkSoft,
};
export default function AuthForm({ join = false }: { join?: boolean }) {
  const r = useRouter(),
    params = useLocalSearchParams<{ returnTo?: string }>(),
    ret = safeReturn(params.returnTo);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState<"password" | "code">("password"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(true),
    [show, setShow] = useState(false);
  async function next() {
    const p = await setup();
    r.replace(
      (p?.onboarding_completed_at
        ? ret || "/(tabs)"
        : "/onboarding/interests" +
          (ret ? "?returnTo=" + encodeURIComponent(ret) : "")) as Href,
    );
  }
  useEffect(() => {
    let alive = true;
    void currentSignIn()
      .then(async (s) => {
        if (s && alive) await next();
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [r, ret]);
  const valid = z.string().email().max(320).safeParse(email.trim()).success;
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const clean = z
        .string()
        .email()
        .max(320)
        .parse(email.trim().toLowerCase());
      if (!join && mode === "password") {
        if (!supabase) throw new Error("Sign-in is unavailable right now.");
        const { error: e } = await supabase.auth.signInWithPassword({
          email: clean,
          password,
        });
        if (e)
          throw new Error(
            "Email or password didn’t match. Try again, or use an email code.",
          );
        setPassword("");
        await currentSignIn();
        await next();
      } else {
        await requestEmailCode(clean);
        const q = new URLSearchParams({ email: clean });
        if (ret) q.set("returnTo", ret);
        if (join) q.set("setupAccount", "1");
        r.push(("/verify-email?" + q.toString()) as Href);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <EntryPage back>
      <Text style={{ ...copy, fontSize: 12, color: colors.brandDeep }}>
        YOUR PEOPLE. YOUR PRODUCT STORIES.
      </Text>
      <EntryTitle>
        {join ? "You belong here." : "Welcome back, Unmasker."}
      </EntryTitle>
      <Text style={copy}>
        {join
          ? "Start with your email. Verify it, then choose your name, location and password in a few short steps."
          : "Your stories, your people, your next discovery. Sign in to pick up where you left off."}
      </Text>
      {checking ? (
        <ContentSkeleton />
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <Text style={copy}>Email address</Text>
            <TextInput
              accessibilityLabel="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              style={field}
            />
          </View>
          {!join && mode === "password" ? (
            <View style={{ gap: 10 }}>
              <Text style={copy}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete="current-password"
                placeholder="Your password"
                style={field}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShow(!show)}
                style={{ paddingVertical: 9 }}
              >
                <Text style={{ ...copy, fontSize: 13 }}>
                  {show ? "Hide password" : "Show password"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ ...copy, fontSize: 13 }}>
              We’ll send a six-digit code through our secure email service.
            </Text>
          )}
          {error ? <StatusMessage kind="error" title={error} /> : null}
          <ActionButton
            label={
              join
                ? "Verify my email"
                : mode === "password"
                  ? "Sign in"
                  : "Send my code"
            }
            pending={busy}
            pendingLabel={
              join || mode === "code" ? "Sending code…" : "Signing in…"
            }
            disabled={
              !valid || busy || (!join && mode === "password" && !password)
            }
            onPress={() => void submit()}
          />
          {!join ? (
            <ActionButton
              tone="ghost"
              label={
                mode === "password"
                  ? "Use an email code instead"
                  : "Use my password"
              }
              disabled={busy}
              onPress={() => {
                setMode(mode === "password" ? "code" : "password");
                setError("");
              }}
            />
          ) : null}
          <ActionButton
            tone="secondary"
            label={
              join ? "Already a member? Sign in" : "New here? Create an account"
            }
            onPress={() =>
              r.replace({
                pathname: join ? "/(auth)/sign-in" : "/sign-up",
                params: ret ? { returnTo: ret } : {},
              } as Href)
            }
          />
          <ActionButton
            tone="ghost"
            label="Explore first"
            onPress={() => {
              void markEntrySeen();
              r.replace("/(tabs)");
            }}
          />
          <Text style={{ ...copy, fontSize: 12 }}>
            Your email stays private. Your name appears on the stories you
            choose to share.
          </Text>
          <View style={{ flexDirection: "row", gap: 20 }}>
            {[
              { label: "Terms", section: "terms" },
              { label: "Privacy", section: "privacy" },
            ].map((x) => (
              <Pressable
                key={x.section}
                accessibilityRole="link"
                onPress={() =>
                  r.push(`/settings/details?section=${x.section}` as Href)
                }
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ ...copy, fontSize: 13 }}>{x.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </EntryPage>
  );
}
