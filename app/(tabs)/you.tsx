import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Badge, Body, Button, Caption, Card, Chip, Heading, Title } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { CONCERN_LABEL, SKIN_TYPE_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';

export default function YouScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const signOut = useAppStore((s) => s.signOut);
  const ownerships = useAppStore((s) => s.ownerships);
  const searchHistory = useAppStore((s) => s.searchHistory);
  const clearSearchHistory = useAppStore((s) => s.clearSearchHistory);
  const userPosts = useAppStore((s) => s.userPosts);
  const flagged = useAppStore((s) => s.flaggedPostIds);

  if (!profile) return null;

  return (
    <Screen>
      <Heading size={21}>You</Heading>
      <Card style={{ alignItems: 'center', padding: 18 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.mist,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28 }}>👤</Text>
        </View>
        <Title>{profile.displayName}</Title>
        <Caption>{profile.email}</Caption>
        {ownerships.length > 0 ? <Badge label="✓ Verified owner" tone="sage" /> : null}
      </Card>

      <Heading size={16}>Skin profile</Heading>
      <Card>
        <Caption>
          {profile.skinType === 'unknown'
            ? 'Skin type not set'
            : `Likely ${SKIN_TYPE_LABEL[profile.skinType]}${
                profile.skinTypeSource === 'quiz_estimated' ? ' (quiz estimate)' : ''
              }`}
        </Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {profile.concerns.length === 0 ? (
            <Caption>No concerns selected</Caption>
          ) : (
            profile.concerns.map((concern) => (
              <Chip key={concern} label={CONCERN_LABEL[concern]} selected />
            ))
          )}
        </View>
        <Button label="Update profile" kind="text" onPress={() => router.push('/(onboarding)/profile')} />
      </Card>

      <Heading size={16}>Your activity</Heading>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Title>{String(userPosts.length)}</Title>
            <Caption>Posts</Caption>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Title>{String(ownerships.length)}</Title>
            <Caption>Marked bought</Caption>
          </View>
        </View>
      </Card>

      <Heading size={16}>Search history</Heading>
      {searchHistory.length === 0 ? (
        <Caption>Searches you make will show up here. You can delete them anytime.</Caption>
      ) : (
        <Card>
          {searchHistory.slice(0, 8).map((item) => (
            <Pressable key={item.id} onPress={() => router.push('/(tabs)/search')} style={{ paddingVertical: 8 }}>
              <Body color={colors.ink}>{item.query}</Body>
            </Pressable>
          ))}
          <Button label="Delete search history" kind="text" onPress={clearSearchHistory} />
        </Card>
      )}

      {profile.isAdmin ? (
        <Button label={`Moderation queue (${flagged.length})`} kind="outline" onPress={() => router.push('/admin')} />
      ) : null}

      <Button
        label="Sign out"
        kind="outline"
        onPress={() => {
          signOut();
          router.replace('/(auth)/sign-in');
        }}
      />
    </Screen>
  );
}
