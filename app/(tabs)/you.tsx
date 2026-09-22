import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Card, Heading, Seg, Title } from '@/components/ui';
import { ShieldCheck } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { hapticHeavy, hapticSelect, hapticSuccess, playHapticTour } from '@/lib/haptics';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { resolvedSkinType, useAppStore, type HapticsMode } from '@/lib/store';

/**
 * You — skin, haptics, sources, privacy, account. Layout from sourced-v1 (2).html.
 */
export default function YouScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const guestSkin = useAppStore((s) => s.guestSkinType);
  const guestSrc = useAppStore((s) => s.guestSkinSource);
  const skin = resolvedSkinType({ profile, guestSkinType: guestSkin });
  const skinSrc = profile?.skinTypeSource ?? guestSrc;
  const hapticsMode = useAppStore((s) => s.hapticsMode);
  const setHapticsMode = useAppStore((s) => s.setHapticsMode);
  const dropsOptIn = useAppStore((s) => s.dropsOptIn);
  const setDropsOptIn = useAppStore((s) => s.setDropsOptIn);
  const saveHistory = useAppStore((s) => s.saveSearchHistory);
  const setSaveHistory = useAppStore((s) => s.setSaveSearchHistory);
  const deleteMyData = useAppStore((s) => s.deleteMyData);
  const flagged = useAppStore((s) => s.flaggedPostIds);
  const [tour, setTour] = useState('');

  const skinLabel = skin ? cap(SKIN_TYPE_LABEL[skin]) : 'Not set yet';
  const skinHint = skin
    ? skinSrc === 'quiz_estimated'
      ? 'Estimated from your quiz. You can change it any time.'
      : 'Chosen by you.'
    : 'Set it once and every product shows Confidence for you.';

  return (
    <Screen>
      <Heading size={34} style={{ marginTop: 12 }}>
        You
      </Heading>

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Caption>Skin type</Caption>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontSize: 26,
                fontWeight: '500',
                color: colors.bone,
                marginTop: 2,
              }}
            >
              {skinLabel}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/quiz-sheet' as Href)}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>
              {skin ? 'Change' : 'Set it'}
            </Text>
          </Pressable>
        </View>
        <Caption>{skinHint}</Caption>
      </Card>

      <View style={{ marginTop: 28 }}>
        <Heading size={22}>Haptics</Heading>
        <Caption>Sourced speaks through touch. Every peel, verdict and reply has its own feel.</Caption>
        <View style={{ marginTop: 12 }}>
          <Seg
            options={[
              { id: 'off', label: 'Off' },
              { id: 'subtle', label: 'Subtle' },
              { id: 'full', label: 'Full' },
            ]}
            value={hapticsMode}
            onChange={(id) => {
              setHapticsMode(id as HapticsMode);
              hapticSuccess();
            }}
          />
        </View>
        <Button
          label="Feel our signature"
          kind="quiet"
          style={{ marginTop: 12 }}
          onPress={() => {
            void playHapticTour(setTour);
          }}
        />
        {tour ? <Caption>{tour}</Caption> : null}
      </View>

      <View style={{ marginTop: 28 }}>
        <Heading size={22}>Where the data comes from</Heading>
        <Caption>
          Public YouTube comments and Reddit threads, plus posts from verified owners on Sourced. Every source
          is labeled wherever it appears. Nothing is paid for and nothing is removed.
        </Caption>
      </View>

      <View style={{ marginTop: 28 }}>
        <Heading size={22}>Privacy</Heading>
        <Tog
          title="Save my search history"
          small="Visible to you only. Delete any time."
          on={saveHistory}
          onPress={() => {
            setSaveHistory(!saveHistory);
            hapticSelect();
          }}
        />
        <Tog
          title="Drops from Sourced"
          small="A message when something has been community-tested for your skin. Sponsored ones are always labeled. Off unless you turn it on."
          on={dropsOptIn}
          onPress={() => {
            setDropsOptIn(!dropsOptIn);
            if (!dropsOptIn) hapticSuccess();
            else hapticSelect();
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 14,
            paddingVertical: 15,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <View style={{ flex: 1 }}>
            <Title>Progress photos</Title>
            <Caption>Always private until you share, one entry at a time.</Caption>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 28, marginBottom: 12 }}>
        <Heading size={22}>Account</Heading>
        <Caption>
          {profile
            ? 'Verified. Your skin details and saved products are kept.'
            : 'You’re using Sourced without an account. You only need one to save your profile, post, or mark something as bought.'}
        </Caption>
        {!profile ? (
          <Button
            label="Verify with Google or email"
            style={{ marginTop: 14 }}
            onPress={() => router.push('/(auth)/sign-in')}
          />
        ) : null}
        <Button
          label="Delete my data"
          kind="quiet"
          style={{ marginTop: 10 }}
          onPress={() => {
            deleteMyData();
            hapticHeavy();
          }}
        />
        {profile?.isAdmin ? (
          <Button
            label={`Moderation queue (${flagged.length})`}
            kind="quiet"
            icon={ShieldCheck}
            style={{ marginTop: 10 }}
            onPress={() => router.push('/admin')}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Tog({
  title,
  small,
  on,
  onPress,
}: {
  title: string;
  small: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      <View style={{ flex: 1 }}>
        <Title>{title}</Title>
        <Caption>{small}</Caption>
      </View>
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          padding: 3,
          backgroundColor: on ? colors.sage : colors.lac2,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.bone,
            alignSelf: on ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
