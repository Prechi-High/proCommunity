import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { MasonryFeed } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Caption, Heading } from '@/components/ui';
import { colors } from '@/constants/theme';
import { getFeedPosts } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';

export default function GlobalFeedScreen() {
  const router = useRouter();
  const userPosts = useAppStore((state) => state.userPosts);
  const posts = getFeedPosts(undefined, userPosts);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <Heading size={16}>From the community</Heading>
      </View>
      <Caption>Critical and glowing posts shown equally — nothing hidden, nothing boosted.</Caption>
      <MasonryFeed posts={posts} onPressPost={(post) => router.push(`/product/${post.productId}`)} />
    </Screen>
  );
}
