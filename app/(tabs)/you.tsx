import { membership } from "@/lib/creator/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import { ProfileIdentity } from "@/components/profiles/Identity";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/profiles/api";
import * as investigations from "@/lib/investigations/api";
import * as clarity from "@/lib/clarity/api";
export default function You() {
  const p = useAppStore((s) => s.profile);
  const r = useRouter();
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
    queryKey: ["profile-counts", p?.id, p?.id],
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
  const q = identity.data;
  const go = (path: string) => r.push(path as Href);
  return (
    <UtilityPage title="You" sub="PRIVATE ACCOUNT HOME" hideNav>
      {!p ? (
        <SignInCard />
      ) : (
        <>
          <Busy
            loading={identity.isLoading}
            error={identity.error}
            retry={() => void identity.refetch()}
          />
          <ProfileIdentity
            name={q?.display_name || p.displayName}
            handle={q?.handle}
            bio={q?.bio}
            avatar={q?.avatar_url}
          />
          <Button
            quiet
            label="View public profile"
            onPress={() => go(`/member/${p.id}`)}
          />
          <Button label="Edit profile" onPress={() => go("/profile/edit")} />
          <Card>
            <Heading>Your private wallet</Heading>
            <Busy
              loading={wallet.isLoading}
              error={wallet.error}
              retry={() => void wallet.refetch()}
            />
            {wallet.isSuccess ? (
              <Copy>
                {wallet.data?.sparks ?? 0} Sparks · {wallet.data?.thunder ?? 0}{" "}
                Thunder Sparks
              </Copy>
            ) : null}
            <Button quiet label="View wallet" onPress={() => go("/wallet")} />
          </Card>
          <Card>
            <Button
              quiet
              label={`My experiences${experiences.isSuccess ? ` · ${experiences.data?.length ?? 0}` : ""}`}
              onPress={() => go("/contribute?mine=1")}
            />
            <Button
              quiet
              label="My questions"
              onPress={() => go("/profile/questions")}
            />
            <Button
              quiet
              label="Investigations supported"
              onPress={() => go("/wallet/history")}
            />
            <Button
              quiet
              label="Saved items"
              onPress={() => go("/saved-items")}
            />
          </Card>
          <Card>
            <Busy
              loading={counts.isLoading}
              error={counts.error}
              retry={() => void counts.refetch()}
            />
            <Button
              quiet
              label={`Following${counts.data?.following !== undefined ? ` · ${counts.data.following}` : ""}`}
              onPress={() => go("/profile/people?tab=Following")}
            />
            <Button
              quiet
              label={`Followers${counts.data?.followers !== undefined ? ` · ${counts.data.followers}` : ""}`}
              onPress={() => go("/profile/people?tab=Followers")}
            />
          </Card>
        </>
      )}
      {creator.data ? (
        <Card>
          <Heading>Creator workspace</Heading>
          <Copy>Assignments, video submissions and earnings.</Copy>
          <Button
            label="Open creator workspace"
            onPress={() => go("/creator")}
          />
        </Card>
      ) : null}
      <Card>
        <Heading>Your product context</Heading>
        <Copy>Private until you choose to share.</Copy>
        <Button
          quiet
          label="Manage personal context"
          onPress={() => go("/clarity-settings")}
        />
      </Card>
      <Card>
        <Button quiet label="Settings" onPress={() => go("/settings")} />
        <Button quiet label="Help" onPress={() => go("/help")} />
        <Button
          quiet
          label="Notifications"
          onPress={() => go("/notifications")}
        />
        {p?.isAdmin ? (
          <Button quiet label="Admin" onPress={() => go("/admin")} />
        ) : null}
      </Card>
    </UtilityPage>
  );
}
