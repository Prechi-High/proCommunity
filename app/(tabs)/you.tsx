import { Pressable, Text, View } from 'react-native';
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
import { CONCERN_LABEL, SKIN_TYPE_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';

/**
 * "You" — the account surface.
 *
 * Framed around control rather than settings: what we know about you, why we
 * know it, and how to remove it. Search history sits next to a one-tap delete
 * for the same reason the store list names its own fairness — stating it is
 * what makes it believable.
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

  if (!profile) return null;

  const verified = ownerships.length > 0;

  return (
    <Screen>
      <Heading size={21}>You</Heading>

      <Card level="raised" style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
        <Avatar name={profile.displayName} size={76} verified={verified} />
        <Title>{profile.displayName || 'Your account'}</Title>
        <Caption>{profile.email}</Caption>
        {verified ? <VerifiedBadge /> : null}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatBlock value={String(userPosts.length)} label="Posts" />
          <StatBlock value={String(ownerships.length)} label="Owned" />
          <StatBlock value={String(satchelItems.length)} label="In Satchel" />
        </View>
      </Card>

      <SectionHeader title="Your skin profile" hint="Shapes your fit scores. Nothing else." />
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

      <Pressable
        onPress={() => router.push('/satchel' as Href)}
        accessibilityRole="link"
        accessibilityLabel="Your Satchel"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.mist,
          borderRadius: radii.card,
          padding: 13,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.rosewoodSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Handbag size={19} color={colors.rosewood} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Title>Your Satchel</Title>
          <Caption>
            {satchelItems.length
              ? `${satchelItems.length} collected — nothing expires`
              : 'Empty right now'}
          </Caption>
        </View>
        <CaretRight size={14} color={colors.inkSoft} weight="bold" />
      </Pressable>

      <SectionHeader title="Search history" hint="Stored on your account so you can delete it." />
      {searchHistory.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MagnifyingGlass size={17} color={colors.inkSoft} weight="regular" />
          <Caption>Nothing searched yet. Whatever you search shows here, and only here.</Caption>
        </Card>
      ) : (
        <Card style={{ gap: 2 }}>
          {searchHistory.slice(0, 8).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push('/(tabs)/search')}
              style={{ paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }}
            >
              <MagnifyingGlass size={13} color={colors.inkSoft} weight="regular" />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink }}>
                {item.query}
              </Text>
            </Pressable>
          ))}
          <Button
            label="Delete all of it"
            kind="text"
            icon={Trash}
            onPress={clearSearchHistory}
          />
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
          Your skin profile, journal and search history are used only to rank products for you. They are
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
