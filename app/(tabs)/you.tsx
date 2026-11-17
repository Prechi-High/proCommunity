import * as ImagePicker from "expo-image-picker";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { memberIdentity, foundingMember } from "@/lib/membership";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import {
  ActionButton,
  AppShell,
  Avatar,
  GroupedList,
  GroupedRow,
  StatusMessage,
} from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
import { features } from "@/lib/features";
import { membership } from "@/lib/creator/api";
import * as clarity from "@/lib/clarity/api";
import * as investigations from "@/lib/investigations/api";
import * as api from "@/lib/profiles/api";
import { hapticSelect } from "@/lib/haptics";
import { useAppStore } from "@/lib/store";
import { useLocalAvatar } from "@/lib/profile/localAvatar";
import { VISION_SCREENS } from "@/lib/navigation/visionNav";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text
        style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 12,
          color: colors.inkSoft,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function You() {
  const p = useAppStore((s) => s.profile);
  const router = useRouter();
  const member = useQuery({ queryKey: ["member-identity", p?.id], queryFn: () => memberIdentity(p!.id), enabled: !!p?.id });
  const founder = useQuery({ queryKey: ["founding-member", p?.id], queryFn: () => foundingMember(p!.id), enabled: !!p?.id });
  const go = (path: string) => router.push(path as Href);
  const identity = useQuery({
    queryKey: ["public-identity", p?.id],
    queryFn: () => api.identity(p!.id),
    enabled: !!p,
  });
  const wallet = useQuery({
    queryKey: ["spark-wallet", p?.id],
    queryFn: investigations.wallet,
    enabled: !!p,
  });
  const counts = useQuery({
    queryKey: ["profile-counts", p?.id],
    queryFn: () => api.counts(p!.id),
    enabled: !!p,
  });
  const experiences = useQuery({
    queryKey: ["my-clarity-experiences", p?.id],
    queryFn: () => clarity.experiences(true),
    enabled: !!p,
  });
  const creator = useQuery({
    queryKey: ["creator-membership", p?.id],
    queryFn: membership,
    enabled: features.creatorStudio && !!p,
  });
  const name = p?.displayName || identity.data?.display_name || "You";
  const localAvatar = useLocalAvatar((s) => s.uri);
  const setLocalAvatar = useLocalAvatar((s) => s.setUri);
  const avatarSrc = localAvatar || identity.data?.avatar_url || "";
  const [avatarError, setAvatarError] = useState("");
  const queryClient = useQueryClient();

  async function changeAvatar() {
    if (!p?.id) return;
    hapticSelect();
    setAvatarError("");
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: Platform.OS === "web",
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const uri = asset?.base64
      ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
      : asset?.uri;
    if (!uri) return;
    setLocalAvatar(uri);
    try {
      const url = await api.uploadAvatar(uri);
      await api.save({
        display_name: identity.data?.display_name || name,
        handle: identity.data?.handle || name.toLowerCase().replace(/\s+/g, "_"),
        bio: identity.data?.bio || "",
        avatar_url: url,
        social_links: identity.data?.social_links || [],
        show_support: identity.data?.show_support ?? true,
        show_counts: identity.data?.show_counts ?? true,
      });
      void queryClient.invalidateQueries({ queryKey: ["public-identity", p.id] });
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Couldn’t upload that photo. It’s saved on this device for now.");
    }
  }

  return (
    <AppShell
      title={VISION_SCREENS.myUnmask.title}
      notify
      ambient="page"
      subtitle={VISION_SCREENS.myUnmask.subtitle}
    >
      {!p ? (
        <View style={{ gap: 20, paddingTop: 8 }}>
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <Avatar name="You" size={72} />
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                lineHeight: 24,
                color: colors.inkSoft,
                textAlign: "center",
              }}
            >
              You are welcome to look. Get Started to become an Unmasker, start with one product, and keep a timeline.
            </Text>
          </View>
          <ActionButton label="Get Started" onPress={() => go("/sign-up")} />
          <ActionButton tone="ghost" label="Already an Unmasker? Sign in" onPress={() => go("/(auth)/sign-in")} />
        </View>
      ) : (
        <View style={{ gap: 28 }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => void changeAvatar()}>
              <MemberAvatar name={name} uri={avatarSrc || undefined} size={72} claimed={!!member.data} founding={!!founder.data} />
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: fonts.serifBold,
                  fontSize: 26,
                  lineHeight: 30,
                  color: colors.ink,
                  letterSpacing: -0.4,
                }}
              >
                {name}
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.6, color: colors.brand }}>
                Unmasker
              </Text>
              {avatarError ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.brand, lineHeight: 18 }}>
                  {avatarError}
                </Text>
              ) : null}
              {identity.data?.handle ? (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 15,
                    color: colors.inkSoft,
                  }}
                >
                  @{identity.data.handle}
                </Text>
              ) : null}
            </View>
          </View>
          {identity.data?.bio ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                lineHeight: 24,
                color: colors.ink,
              }}
            >
              {identity.data.bio}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", paddingVertical: 8 }}>
            <Stat
              value={
                experiences.isLoading
                  ? "—"
                  : experiences.isError
                    ? "—"
                    : (experiences.data?.length ?? 0)
              }
              label="Experiences"
            />
            <Stat
              value={
                counts.isLoading
                  ? "—"
                  : counts.isError
                    ? "—"
                    : (counts.data?.following ?? 0)
              }
              label="Following"
            />
            <Stat
              value={
                wallet.isLoading
                  ? "—"
                  : wallet.isError
                    ? "—"
                    : (wallet.data?.sparks ?? 0)
              }
              label="Sparks"
            />
          </View>
          <ActionButton
            tone="secondary"
            label="View public profile"
            onPress={() => go(`/member/${p.id}`)}
          />
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 13,
                letterSpacing: 0.5,
                color: colors.inkSoft,
              }}
            >
              MY THINGS
            </Text>
            <GroupedList>
              <GroupedRow
                label="My posts"
                onPress={() => go("/contribute?mine=1")}
              />
              <GroupedRow label="Saved" onPress={() => go("/saved-items")} />
              <GroupedRow
                label="Following"
                onPress={() => go("/profile/people?tab=Following")}
              />
              <GroupedRow
                label="Edit profile"
                onPress={() => go("/profile/edit")}
                last
              />
            </GroupedList>
          </View>
          {features.ultraUnmask ? (
            <View style={{ gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  letterSpacing: 0.5,
                  color: colors.inkSoft,
                }}
              >
                SPARKS
              </Text>
              <GroupedList>
                <GroupedRow
                  label="Wallet"
                  detail={
                    wallet.isError
                      ? "Unavailable"
                      : `${wallet.isLoading ? "—" : wallet.isError ? "—" : (wallet.data?.sparks ?? 0)}`
                  }
                  onPress={() => go("/wallet")}
                  last
                />
              </GroupedList>
              {wallet.isError ? (
                <StatusMessage kind="error" title="Couldn’t load balance." />
              ) : null}
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.inkSoft,
                }}
              >
                Sparks are support you can add from a question. 10 Sparks = ₦100.
                They cannot buy an answer.
              </Text>
            </View>
          ) : null}
          {features.creatorStudio && creator.data ? (
            <ActionButton
              label="Creator workspace"
              onPress={() => go("/creator")}
            />
          ) : null}
          <GroupedList>
            <GroupedRow label="Settings" onPress={() => go("/settings")} />
            <GroupedRow
              label="Notifications"
              onPress={() => go("/notifications")}
            />
            <GroupedRow
              label="Help"
              onPress={() => go("/help")}
              last={!p.isAdmin}
            />
            {p.isAdmin ? (
              <GroupedRow label="Team desk" onPress={() => go("/team")} last />
            ) : null}
          </GroupedList>
        </View>
      )}
    </AppShell>
  );
}
