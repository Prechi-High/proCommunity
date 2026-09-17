import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Avatar, Body, Button, Caption, Card, Heading, Title } from '@/components/ui';
import { Check, ShieldCheck, Warning } from '@/components/icons';
import { colors } from '@/constants/theme';
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

  const flagged = [...communityPosts, ...userPosts].filter((post) =>
    flaggedPostIds.includes(post.id),
  );

  return (
    <Screen>
      <Heading size={21}>Moderation</Heading>
      <Caption>
        Flag medical claims and adverse-reaction posts. Serious reactions route to the merchant, not to
        us. Negative opinion is not a reason to remove a post.
      </Caption>

      {flagged.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 7, paddingVertical: 28 }}>
          <ShieldCheck size={25} color={colors.sage} weight="regular" />
          <Title>Queue is clear</Title>
          <Body>Long-press a community post to flag it for review.</Body>
        </Card>
      ) : (
        flagged.map((post) => (
          <Card key={post.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar userId={post.userId} name={post.authorName} size={34} />
              <View style={{ flex: 1 }}>
                <Title>{post.authorName}</Title>
                <Caption>{post.type}</Caption>
              </View>
              <Warning size={17} color={colors.honey} weight="fill" />
            </View>
            <Body color={colors.ink}>{post.body}</Body>
            <Button label="Resolve" kind="quiet" icon={Check} onPress={() => resolveFlag(post.id)} />
          </Card>
        ))
      )}
    </Screen>
  );
}
