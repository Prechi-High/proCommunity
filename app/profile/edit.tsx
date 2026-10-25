import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import { ProfileIdentity } from "@/components/profiles/Identity";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";
export default function EditProfile() {
  const user = useAppStore((s) => s.profile);
  const r = useRouter();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["public-identity", user?.id],
    queryFn: () => api.identity(user!.id),
    enabled: !!user,
  });
  const [name, setName] = useState(user?.displayName ?? "");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [support, setSupport] = useState(false);
  const [counts, setCounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (q.data && !dirty) {
      setName(q.data.display_name);
      setHandle(q.data.handle);
      setBio(q.data.bio);
      setAvatar(q.data.avatar_url);
      setLinks(q.data.social_links);
      setSupport(q.data.show_support);
      setCounts(q.data.show_counts);
    }
  }, [q.data, dirty]);
  const changed = () => {
    setDirty(true);
    setSaved(false);
  };
  const pick = async () => {
    setBusy(true);
    setError("");
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow photo access to choose an avatar.");
      const out = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!out.canceled) {
        setAvatar(await api.uploadAvatar(out.assets[0].uri));
        changed();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (links.some((v) => !api.safeLink(v)))
        throw new Error("Social links must be complete HTTPS addresses.");
      await api.save({
        display_name: name.trim(),
        handle: handle.toLowerCase().replace(/^@/, ""),
        bio: bio.trim(),
        avatar_url: avatar,
        social_links: links,
        show_counts: counts,
        show_support: support,
      });
      await qc.invalidateQueries({ queryKey: ["public-identity"] });
      await qc.invalidateQueries({ queryKey: ["profile-counts"] });
      await qc.invalidateQueries({ queryKey: ["profile-support"] });
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("duplicate")
          ? "This handle is taken. Choose another."
          : e instanceof Error
            ? e.message
            : "Could not save your profile.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <UtilityPage
      title="Make this space yours."
      sub="Your name, handle and bio appear on your public profile."
    >
      {!user ? (
        <SignInCard />
      ) : (
        <>
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          <ProfileIdentity
            name={name || "You"}
            handle={handle}
            avatar={avatar}
          />
          <Button
            quiet
            disabled={busy}
            label={busy ? "Please wait…" : "Change photo"}
            onPress={() => void pick()}
          />
          <Copy small>
            Profile photos are public. JPG, PNG or WebP, up to 2 MB.
          </Copy>
          <Field
            label="Display name"
            value={name}
            onChange={(v) => {
              changed();
              setName(v);
            }}
          />
          <Field
            label="Handle"
            value={handle}
            onChange={(v) => {
              changed();
              setHandle(v);
            }}
          />
          <Copy small>3–24 lowercase letters, numbers or underscores.</Copy>
          <Field
            label="Bio"
            multiline
            value={bio}
            onChange={(v) => {
              changed();
              setBio(v);
            }}
          />
          <Copy small>{bio.length}/280 characters</Copy>
          <Heading>Social links</Heading>
          {links.map((v, i) => (
            <View key={i} style={{ gap: 8 }}>
              <Field
                label={`Link ${i + 1}`}
                value={v}
                onChange={(next) => {
                  changed();
                  setLinks(links.map((x, j) => (j === i ? next : x)));
                }}
              />
              <Button
                quiet
                label={`Remove link ${i + 1}`}
                onPress={() => {
                  changed();
                  setLinks(links.filter((_, j) => j !== i));
                }}
              />
            </View>
          ))}
          <Button
            quiet
            disabled={links.length >= 5}
            label="Add link"
            onPress={() => {
              changed();
              setLinks([...links, ""]);
            }}
          />
          <Card>
            <Heading>Public visibility</Heading>
            {[
              ["Show supported investigations", support, setSupport],
              ["Show follower counts", counts, setCounts],
            ].map(([label, value, setter]) => (
              <View
                key={String(label)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Copy>{String(label)}</Copy>
                </View>
                <Switch
                  accessibilityLabel={String(label)}
                  value={value as boolean}
                  onValueChange={(v) => {
                    changed();
                    (setter as (x: boolean) => void)(v);
                  }}
                />
              </View>
            ))}
            <Copy small>
              Supported investigations include only contributions you already
              acknowledged publicly. Anonymous support stays anonymous.
            </Copy>
          </Card>
          <Card>
            <Copy>
              Skin type and personal product context are managed separately.
              Share them on individual contributions when you choose.
            </Copy>
            <Button
              quiet
              label="Manage personal context"
              onPress={() => r.push("/clarity-settings")}
            />
          </Card>
          {error ? <Notice>{error}</Notice> : null}
          {saved ? <Notice>Profile saved.</Notice> : null}
          <Button
            disabled={
              busy ||
              q.isLoading ||
              q.isError ||
              name.trim().length < 2 ||
              name.trim().length > 40 ||
              bio.length > 280 ||
              !/^@?[a-z0-9_]{3,24}$/.test(handle)
            }
            label={busy ? "Saving…" : "Save changes"}
            onPress={() => void save()}
          />
          <Button
            quiet
            disabled={busy}
            label="Cancel"
            onPress={() => (dirty ? setConfirm(true) : r.back())}
          />
          {confirm ? (
            <Card>
              <Copy>Discard your unsaved changes?</Copy>
              <Button
                label="Discard changes"
                onPress={() => (r.canGoBack() ? r.back() : r.replace("/you"))}
              />
              <Button
                quiet
                label="Keep editing"
                onPress={() => setConfirm(false)}
              />
            </Card>
          ) : null}
        </>
      )}
    </UtilityPage>
  );
}
