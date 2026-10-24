import { useState } from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
import { useAppStore, type HapticsMode } from "@/lib/store";
import { signOutEverywhere } from "@/lib/auth";
export default function Settings() {
  const r = useRouter();
  const save = useAppStore((s) => s.saveSearchHistory);
  const setSave = useAppStore((s) => s.setSaveSearchHistory);
  const mode = useAppStore((s) => s.hapticsMode);
  const setMode = useAppStore((s) => s.setHapticsMode);
  const clearSearch = useAppStore((s) => s.clearSearchHistory);
  const clearRecent = useAppStore((s) => s.clearRecentProducts);
  const uid = useAppStore((s) => s.profile?.id);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <UtilityPage title="Your account. Your choices.">
      <Card>
        <Heading>Profile & privacy</Heading>
        <Copy>
          Sharing an experience is always your choice. Viewing a product does
          not publish a post.
        </Copy>
        <Button
          quiet
          label="Edit profile & personal context"
          onPress={() => r.push("/clarity-settings")}
        />
      </Card>
      <Card>
        <Heading>On this device</Heading>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Copy>Remember search history</Copy>
          <Switch
            accessibilityLabel="Remember search history"
            value={save}
            onValueChange={setSave}
          />
        </View>
        <Copy small>This changes history saved on this device.</Copy>
        <Copy>Haptic feedback</Copy>
        <Chips
          options={["off", "subtle", "full"]}
          value={mode}
          onChange={(v) => setMode(v as HapticsMode)}
        />
        <Button
          quiet
          label="Clear search & recently viewed history"
          onPress={() => setConfirm(true)}
        />
        {confirm ? (
          <>
            <Copy>
              Clear this device’s search and recently viewed history? Saved
              products stay saved.
            </Copy>
            <Button
              label="Yes, clear history"
              onPress={() => {
                clearSearch();
                clearRecent();
                setConfirm(false);
                setNotice("History cleared on this device.");
              }}
            />
            <Button quiet label="Cancel" onPress={() => setConfirm(false)} />
          </>
        ) : null}
      </Card>
      <Card>
        <Heading>Stay connected</Heading>
        <Button
          quiet
          label="Notifications"
          onPress={() => r.push("/notifications")}
        />
        <Button
          quiet
          label="WhatsApp preferences"
          onPress={() => r.push("/settings/whatsapp")}
        />
        <Button
          quiet
          label="Wallet & support credits"
          onPress={() => r.push("/wallet")}
        />
        <Button quiet label="Help & support" onPress={() => r.push("/help")} />
      </Card>
      {notice ? <Notice>{notice}</Notice> : null}
      {uid ? (
        <Button
          quiet
          disabled={busy}
          label={busy ? "Signing out…" : "Sign out"}
          onPress={() => {
            setBusy(true);
            void signOutEverywhere()
              .catch(() => setNotice("Could not sign out. Please retry."))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </UtilityPage>
  );
}
