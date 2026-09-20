import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import {
  Avatar,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  SectionHeader,
  StatBlock,
  Title,
  VerifiedBadge,
} from '@/components/ui';
import {
  CaretRight,
  Handbag,
  Lock,
  MagnifyingGlass,
  PencilSimple,
  ShieldCheck,
  Trash,
} from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { CONCERN_LABEL, SKIN_TYPE_LABEL } from '@/lib/quiz';
import { useAppStore, type HapticsMode } from '@/lib/store';

/**
 * You — control surface: skin, feel, drops (default off), history, delete.
 * Prefs work signed-out; account extras need sign-in.
 */
export default function YouScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const signOut = useAppStore((s) => s.signOut);
  const ownerships = useAppStore((s) => s.ownerships);
  const searchHistory = useAppStore((s) => s.searchHistory);
  const clearSearchHistory = useAppStore((s) => s.clearSearchHistory);
  const userPosts = useAppStore((s) => s.userPosts);
  const satchelItems = useAppStore((s) => s.satchelItems);
  const flagged = useAppStore((s) => s.flaggedPostIds);
  const hapticsMode = useAppStore((s) => s.hapticsMode);
  const setHapticsMode = useAppStore((s) => s.setHapticsMode);
  const dropsOptIn = useAppStore((s) => s.dropsOptIn);
  const setDropsOptIn = useAppStore((s) => s.setDropsOptIn);

  if (!profile) {
    return (
      <Screen>
        <Heading size={34}>You</Heading>
        <Caption color={colors.bone2}>
          You can search without an account. Sign in to keep your skin details, saved products and routine.
        </Caption>
        <Button
          label="Continue with Google"
          kind="hl"
          onPress={() => router.push('/(auth)/sign-in')}
          style={{ marginTop: 18 }}
        />
        <Button
          label="Use email instead"
          kind="quiet"
          onPress={() => router.push('/(auth)/sign-in')}
          style={{ marginTop: 10 }}
        />
        <Button label="Not now" kind="text" onPress={() => router.push('/(tabs)')} style={{ marginTop: 6 }} />

        <PrefsBlock
          hapticsMode={hapticsMode}
          setHapticsMode={setHapticsMode}
          dropsOptIn={dropsOptIn}
          setDropsOptIn={setDropsOptIn}
        />
      </Screen>
    );
  }

  const verified = ownerships.length > 0;

  return (
    <Screen>
      <Heading size={34}>You</Heading>

      <Card level="raised" style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
        <Avatar name={profile.displayName} size={76} verified={verified} />
        <Title>{profile.displayName || 'Your account'}</Title>
        <Caption>{profile.email}</Caption>
        {verified ? <VerifiedBadge /> : null}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatBlock value={String(userPosts.length)} label="Traces" />
          <StatBlock value={String(ownerships.length)} label="Owned" />
          <StatBlock value={String(satchelItems.length)} label="In Satchel" />
        </View>
      </Card>

      <SectionHeader title="Your skin profile" hint="Shapes Confidence for you. Always an estimate you can change." />
      <Card style={{ gap: 11 }}>
        <Title>
          {profile.skinType === 'unknown'
            ? 'Skin type not set'
            : `${SKIN_TYPE_LABEL[profile.skinType]}${
                profile.skinTypeSource === 'quiz_estimated' ? ' — from the quiz, your estimate' : ''
              }`}
        </Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {profile.concerns.length === 0 ? (
            <Caption>No concerns selected</Caption>
          ) : (
            profile.concerns.map((concern) => (
              <Chip key={concern} label={CONCERN_LABEL[concern]} selected />
            ))
          )}
        </View>
        <Button
          label="Change any of this"
          kind="text"
          icon={PencilSimple}
          onPress={() => router.push('/(onboarding)/profile')}
        />
      </Card>

      <PrefsBlock
        hapticsMode={hapticsMode}
        setHapticsMode={setHapticsMode}
        dropsOptIn={dropsOptIn}
        setDropsOptIn={setDropsOptIn}
      />

      <Pressable
        onPress={() => router.push('/satchel' as Href)}
        accessibilityRole="link"
        accessibilityLabel="Your Satchel"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.lac,
          borderRadius: radii.card,
          padding: 13,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.lac2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Handbag size={19} color={colors.bone} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Title>Your Satchel</Title>
          <Caption>
            {satchelItems.length
              ? `${satchelItems.length} collected — nothing expires`
              : 'Empty right now'}
          </Caption>
        </View>
        <CaretRight size={14} color={colors.bone3} weight="bold" />
      </Pressable>

      <SectionHeader title="Search history" hint="Stored on this device so you can delete it." />
      {searchHistory.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MagnifyingGlass size={17} color={colors.bone3} weight="regular" />
          <Caption>Nothing searched yet. Whatever you search can show here, and only here.</Caption>
        </Card>
      ) : (
        <Card style={{ gap: 2 }}>
          {searchHistory.slice(0, 8).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push('/(tabs)')}
              style={{ paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }}
            >
              <MagnifyingGlass size={13} color={colors.bone3} weight="regular" />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.bone }}>
                {item.query}
              </Text>
            </Pressable>
          ))}
          <Button label="Delete all of it" kind="text" icon={Trash} onPress={clearSearchHistory} />
        </Card>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          backgroundColor: colors.sageSoft,
          borderRadius: radii.card,
          padding: 13,
        }}
      >
        <Lock size={16} color={colors.sage} weight="fill" />
        <Caption>
          Your skin profile, journal and search history are used only to shape Confidence for you. They are
          never sold, and never shown to other members.
        </Caption>
      </View>

      {profile.isAdmin ? (
        <Button
          label={`Moderation queue (${flagged.length})`}
          kind="quiet"
          icon={ShieldCheck}
          onPress={() => router.push('/admin')}
        />
      ) : null}

      <Button
        label="Sign out"
        kind="quiet"
        onPress={() => {
          signOut();
          router.replace('/(auth)/sign-in');
        }}
      />
    </Screen>
  );
}

function PrefsBlock({
  hapticsMode,
  setHapticsMode,
  dropsOptIn,
  setDropsOptIn,
}: {
  hapticsMode: HapticsMode;
  setHapticsMode: (m: HapticsMode) => void;
  dropsOptIn: boolean;
  setDropsOptIn: (on: boolean) => void;
}) {
  const modes: HapticsMode[] = ['off', 'subtle', 'full'];
  return (
    <View style={{ marginTop: 8, gap: 18 }}>
      <View>
        <SectionHeader title="Haptics" hint="How Sourced feels in your hand." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {modes.map((m) => (
            <Chip
              key={m}
              label={m === 'off' ? 'Off' : m === 'subtle' ? 'Subtle' : 'Full'}
              selected={hapticsMode === m}
              onPress={() => {
                setHapticsMode(m);
                hapticTap();
              }}
            />
          ))}
        </View>
      </View>

      <View>
        <SectionHeader
          title="Product drops"
          hint="Opt in separately. Default off. Never changes search or scores."
        />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Title>Drops</Title>
            <Caption>
              {dropsOptIn
                ? 'On — matched invites only, labeled sponsored.'
                : 'Off — you won’t see drop invites.'}
            </Caption>
          </View>
          <Switch
            value={dropsOptIn}
            onValueChange={(on) => {
              hapticTap();
              setDropsOptIn(on);
            }}
            trackColor={{ false: colors.line, true: colors.sage }}
            thumbColor={colors.bone}
          />
        </Card>
      </View>
    </View>
  );
}
