import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
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
import { membership } from "@/lib/creator/api";
import * as clarity from "@/lib/clarity/api";
import * as investigations from "@/lib/investigations/api";
import * as api from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";

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
    enabled: !!p,
  });
  const name = identity.data?.display_name || p?.displayName || "You";

  return (
    <AppShell
      title="You"
      notify
      subtitle="Your stories, Sparks, and the Unmaskers you follow."
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
              Read freely. Sign in to share what happened, follow Unmaskers,
              track a product, or add Sparks.
            </Text>
          </View>
          <ActionButton label="Sign in" onPress={() => go("/(auth)/sign-in")} />
        </View>
      ) : (
        <View style={{ gap: 28 }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Avatar name={name} uri={identity.data?.avatar_url} size={72} />
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
              Sparks help a creator take a question further. 10 Sparks = ₦100.
              They cannot buy the answer.
            </Text>
          </View>
          {creator.data ? (
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
