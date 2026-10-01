import { useRouter, type Href } from 'expo-router';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Files, Globe, SealCheck, ShieldCheck, Trash, User, WhatsappLogo } from '@/components/icons';
import { isAuthUserId, signOutEverywhere } from '@/lib/auth';
import { useMyMember } from '@/lib/owners';
import { Eyebrow, Group, GroupRow, LargeTitle, Segmented } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { hapticHeavy, hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useAppStore, type HapticsMode } from '@/lib/store';

export default function YouScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const hapticsMode = useAppStore((s) => s.hapticsMode);
  const setHapticsMode = useAppStore((s) => s.setHapticsMode);
  const saveHistory = useAppStore((s) => s.saveSearchHistory);
  const setSaveHistory = useAppStore((s) => s.setSaveSearchHistory);
  const clearSearchHistory = useAppStore((s) => s.clearSearchHistory);
  const deleteMyData = useAppStore((s) => s.deleteMyData);
  const flagged = useAppStore((s) => s.flaggedPostIds);
  const owned = useMyMember().data?.owned ?? [];

  return (
    <Screen>
      <View style={{ paddingTop: 18, gap: 22 }}>
        <LargeTitle>You</LargeTitle>

        <Pressable
          onPress={() => (profile ? undefined : router.push('/(auth)/sign-in'))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.lac, borderRadius: 16, padding: 16 }}
        >
          {profile ? (
            <Avatar name={profile.displayName} size={52} />
          ) : (
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lac2, alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color={colors.bone3} weight="regular" />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>
              {profile ? profile.displayName : 'Sign in'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
              {profile ? profile.email : 'Post in discussions, sync saves and keep Research Cards.'}
            </Text>
          </View>
        </Pressable>

        {profile && isAuthUserId(profile.id) ? (
          <Group>
            <GroupRow
              icon={SealCheck}
              label="Verified products"
              detail={
                owned.length
                  ? owned.slice(0, 3).map((o) => o.productName).join(', ') + (owned.length > 3 ? ` +${owned.length - 3} more` : '')
                  : 'Prove you own something with a quick in-app photo. Your answers about it get the mark.'
              }
              value={owned.length ? String(owned.length) : undefined}
              onPress={() => router.push({ pathname: '/member/[id]', params: { id: profile.id } } as unknown as Href)}
            />
            <GroupRow
              icon={User}
              label="Your public profile"
              detail="What others see: verified products, answers and posts."
              onPress={() => router.push({ pathname: '/member/[id]', params: { id: profile.id } } as unknown as Href)}
              last
            />
          </Group>
        ) : null}

        <Group>
          <GroupRow icon={Files} label="My Research" detail="Your saved Research Cards." onPress={() => router.push('/research' as Href)} />
          <GroupRow icon={WhatsappLogo} label="WhatsApp" detail="Research products by sending a photo or name." badge="Coming soon" onPress={() => router.push('/settings/whatsapp' as Href)} last />
        </Group>

        <View style={{ gap: 8 }}>
          <Eyebrow>Haptics</Eyebrow>
          <Segmented<HapticsMode>
            options={[
              { id: 'off', label: 'Off' },
              { id: 'subtle', label: 'Subtle' },
              { id: 'full', label: 'Full' },
            ]}
            value={hapticsMode}
            onChange={(m) => {
              setHapticsMode(m);
              hapticSuccess();
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Eyebrow>Privacy</Eyebrow>
          <Group>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone }}>Save search history</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>Stays on this device only.</Text>
              </View>
              <Switch
                value={saveHistory}
                onValueChange={(v) => {
                  hapticSelect();
                  setSaveHistory(v);
                }}
                trackColor={{ true: colors.hi, false: colors.wineDeep }}
              />
            </View>
            <GroupRow
              label="Clear search history"
              onPress={() => {
                hapticSelect();
                Alert.alert('Clear search history?', 'This removes recent searches from this device. It cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                      hapticHeavy();
                      clearSearchHistory();
                    },
                  },
                ]);
              }}
            />
            <GroupRow
              label="Delete my data"
              icon={Trash}
              last
              onPress={() => {
                hapticHeavy();
                Alert.alert('Delete your data on this device?', 'This clears search history, saved products, and other local data. Your account stays active.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteMyData(),
                  },
                ]);
              }}
            />
          </Group>
        </View>

        <View style={{ gap: 8 }}>
          <Eyebrow>How Sourced works</Eyebrow>
          <Group>
            <GroupRow icon={Globe} label="Evidence from the open web" detail="Specs, reviews, community discussions and store listings." />
            <GroupRow icon={SealCheck} label="Every claim is sourced" detail="Tap any praise, complaint or spec to see where it came from." />
            <GroupRow icon={ShieldCheck} label="No paid rankings" detail="Sellers can’t pay to change what you see." last />
          </Group>
        </View>

        {profile ? (
          <Group>
            {profile.isAdmin ? (
              <GroupRow label="Admin — insights & moderation" detail={`${flagged.length} flagged posts`} onPress={() => router.push('/admin')} />
            ) : null}
            <GroupRow label="Sign out" last onPress={() => void signOutEverywhere()} />
          </Group>
        ) : null}
      </View>
    </Screen>
  );
}
