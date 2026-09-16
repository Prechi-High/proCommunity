import { Redirect } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Body, Button, Caption, Card, Heading, Title } from '@/components/ui';
import { communityPosts } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

export default function AdminScreen() {
  const profile = useAppStore((s) => s.profile);
  const flaggedPostIds = useAppStore((s) => s.flaggedPostIds);
  const resolveFlag = useAppStore((s) => s.resolveFlag);
  const userPosts = useAppStore((s) => s.userPosts);

  if (!profile?.isAdmin) {
    return <Redirect href="/(tabs)/you" />;
  }

  const flagged = [...communityPosts, ...userPosts].filter((post) => flaggedPostIds.includes(post.id));

  return (
    <Screen>
      <Heading size={21}>Moderation</Heading>
      <Caption>
        Flag medical claims and adverse-reaction posts. Route serious reactions to the merchant, not the platform.
      </Caption>
      {flagged.length === 0 ? (
        <Card>
          <Title>Queue is clear</Title>
          <Body>Long-press a community post to flag it.</Body>
        </Card>
      ) : (
        flagged.map((post) => (
          <Card key={post.id}>
            <Title>{post.authorName}</Title>
            <Body>{post.body}</Body>
            <Caption>{post.type}</Caption>
            <View style={{ marginTop: 8 }}>
              <Button label="Resolve" kind="outline" onPress={() => resolveFlag(post.id)} />
            </View>
          </Card>
        ))
      )}
      <Pressable>
        <Caption>Sign in with an @sourced.local email to use this queue in the preview.</Caption>
      </Pressable>
    </Screen>
  );
}
