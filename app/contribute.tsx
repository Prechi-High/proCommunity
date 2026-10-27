import {
  Redirect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { ExperienceWizard } from "@/components/tracking/ExperienceWizard";
import {
  AppShell,
  ActionButton,
  ContentSkeleton,
  MediaFrame,
  StatusMessage,
} from "@/components/unmask-ui";
import * as clarity from "@/lib/clarity/api";
import * as community from "@/lib/community-v2/api";
import { useAppStore } from "@/lib/store";
import { colors, fonts } from "@/constants/theme";
export default function Contribute() {
  const p = useLocalSearchParams<{
    product?: string;
    journey?: string;
    experience?: string;
    mine?: string;
    update?: string;
    resumeGuest?: string;
  }>();
  const uid = useAppStore((s) => s.profile?.id),
    r = useRouter();
  const own = useQuery({
    queryKey: ["my-clarity-experiences", uid],
    queryFn: () => clarity.experiences(true),
    enabled: !!uid && !!p.mine,
  });
  const source = useQuery({
    queryKey: ["clarity-experience", p.experience, uid],
    queryFn: () => community.experience(p.experience!),
    enabled: !!p.experience && !!p.update,
  });
  if (p.experience && !p.update)
    return <Redirect href={`/story/${p.experience}` as Href} />;
  if (p.mine)
    return (
      <AppShell back navigation title="My experiences">
        {!uid ? (
          <ActionButton
            label="Sign in to see my experiences"
            onPress={() => r.push("/(auth)/sign-in")}
          />
        ) : null}
        {own.isLoading ? <ContentSkeleton /> : null}
        {own.isError ? (
          <ActionButton
            label="Retry experiences"
            onPress={() => void own.refetch()}
          />
        ) : null}
        {own.data?.map((e) => (
          <Pressable
            accessibilityRole="button"
            key={e.id}
            onPress={() => r.push(`/story/${e.id}` as Href)}
            style={{
              flexDirection: "row",
              gap: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 18,
            }}
          >
            <View style={{ width: 60 }}>
              <MediaFrame
                uri={e.unmask_catalog?.image_url}
                label={e.unmask_catalog?.name || "Product"}
                ratio={1}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>
                {e.unmask_catalog?.name}
              </Text>
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.regular, color: colors.inkSoft }}
              >
                {e.body}
              </Text>
            </View>
          </Pressable>
        ))}
        {own.isSuccess && !own.data.length ? (
          <StatusMessage title="Your first experience starts here." />
        ) : null}
        <ActionButton
          label="Add a product experience"
          onPress={() => r.push("/contribute")}
        />
      </AppShell>
    );
  if (p.experience && source.isLoading)
    return (
      <AppShell back title="Opening your experience…">
        <ContentSkeleton />
      </AppShell>
    );
  if (source.isError)
    return (
      <AppShell back title="This experience couldn’t open">
        <ActionButton label="Try again" onPress={() => void source.refetch()} />
      </AppShell>
    );
  return (
    <ExperienceWizard
      key={p.experience || p.product || "new"}
      productId={p.product || source.data?.product_id}
      source={source.data?.user_id === uid ? source.data : undefined}
      initialJourney={p.journey}
      resumeGuest={p.resumeGuest}
    />
  );
}
