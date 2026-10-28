import { QuestionInvitePreference } from "@/components/community/QuestionInvitePreference";
import { useState } from "react";
import { Share, Switch, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
export default function SettingDetails() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const r = useRouter();
  const s = useAppStore();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const title =
    section === "data"
      ? "Data controls"
      : section === "security"
        ? "Sign-in and security"
        : section === "notifications"
          ? "Notification preferences"
          : section === "offers"
            ? "Offers notifications"
            : section === "terms"
              ? "Terms of service"
              : "Privacy policy";
  return (
    <UtilityPage title={title}>
      {section === "data" ? (
        <>
          <Card>
            <Heading>On this device</Heading>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Copy>Remember search history</Copy>
              <Switch
                accessibilityLabel="Remember search history"
                value={s.saveSearchHistory}
                onValueChange={s.setSaveSearchHistory}
              />
            </View>
            <Button
              quiet
              label="Clear search & recently viewed history"
              onPress={() => setConfirm(true)}
            />
            {confirm ? (
              <>
                <Copy>
                  Clear this device’s history? Saved products remain saved.
                </Copy>
                <Button
                  label="Clear history"
                  onPress={() => {
                    s.clearSearchHistory();
                    s.clearRecentProducts();
                    setConfirm(false);
                    setNotice("Device history cleared.");
                  }}
                />
                <Button
                  quiet
                  label="Cancel"
                  onPress={() => setConfirm(false)}
                />
              </>
            ) : null}
            <Copy small>This does not delete server-side account data.</Copy>
          </Card>
          <Button
            quiet
            label="Export device history & product saves"
            onPress={() =>
              void Share.share({
                message: JSON.stringify(
                  {
                    exported_at: new Date().toISOString(),
                    search_history: s.searchHistory,
                    recent_products: s.recentProductIds,
                    saved_products: s.favorites,
                  },
                  null,
                  2,
                ),
              }).catch(() =>
                setNotice("Could not open the export. Please retry."),
              )
            }
          />
          <Button
            quiet
            label="Request account data or deletion"
            onPress={() => r.push("/help")}
          />
        </>
      ) : section === "security" ? (
        <Card>
          <Copy>
            {s.profile
              ? `Signed in as ${s.profile.email}`
              : "You are not signed in."}
          </Copy>
          <Copy>
            Sign in with a password or an email code. Never share your sign-in
            code, password or OTP in Community.
          </Copy>
          {s.profile ? <Button label="Set up my username, location & password" onPress={() => r.push("/complete-account")} /> : null}
          <Button
            label={s.profile ? "Back to account settings" : "Sign in"}
            onPress={() => r.push(s.profile ? "/settings" : "/(auth)/sign-in")}
          />
        </Card>
      ) : section === "notifications" ? (
        <>
          <Card>
            <Copy>
              Follow investigations to see status changes here. Replies and new
              followers also appear in your updates.
            </Copy>
            <Button
              label="View updates"
              onPress={() => r.push("/notifications")}
            />
            <Button
              quiet
              label="Manage following"
              onPress={() => r.push("/profile/people")}
            />
            <Button
              quiet
              label="WhatsApp preferences"
              onPress={() => r.push("/settings/whatsapp")}
            />
          </Card>
          <QuestionInvitePreference />
          <Heading>Interface sounds</Heading>
          <Copy>
            Optional, quiet feedback. Video sound is controlled separately.
          </Copy>
          <Switch
            accessibilityLabel="Interface sounds"
            value={s.interfaceSounds}
            onValueChange={s.setInterfaceSounds}
          />
          <Heading>Haptic feedback</Heading>
          <Chips
            options={["off", "subtle", "expressive"]}
            value={s.hapticsMode === "full" ? "expressive" : s.hapticsMode}
            onChange={(v) => s.setHapticsMode(v as HapticsMode)}
          />
        </>
      ) : section === "offers" ? (
        <Notice>
          Offers notifications are not available yet. No offer-notification
          subscription is created here.
        </Notice>
      ) : (
        <>
          <Notice>
            The published{" "}
            {section === "terms" ? "terms of service" : "privacy policy"} has
            not been connected to this app yet.
          </Notice>
          <Button
            quiet
            label="Ask about your data or account"
            onPress={() => r.push("/help")}
          />
        </>
      )}
      {notice ? <Notice>{notice}</Notice> : null}
    </UtilityPage>
  );
}
