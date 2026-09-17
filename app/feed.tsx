import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { MasonryFeed } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Caption, Heading } from '@/components/ui';
import { BackButton, Scales } from '@/components/icons';
import { colors } from '@/constants/theme';
import { getFeedPosts } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';

/**
 * 04b — Discovery Feed.
 *
 * Chrome is kept deliberately thin so the photographs start almost immediately;
 * the feeling to produce is "let me just see one more". The ordering line is
 * the one piece of text worth reading twice — this is the screen where it would
 * be easiest to quietly favour the flattering posts, and we don't.
 */
export default function GlobalFeedScreen() {
  const router = useRouter();
  const userPosts = useAppStore((state) => state.userPosts);
  const posts = getFeedPosts(undefined, userPosts);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Heading size={19}>From the community</Heading>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Scales size={13} color={colors.inkSoft} weight="regular" />
        <Caption>
          {`${posts.length} posts, newest first. Glowing and critical appear in the same order they were written.`}
        </Caption>
      </View>

      <MasonryFeed posts={posts} onPressPost={(post) => router.push(`/product/${post.productId}`)} />
    </Screen>
  );
}
