import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { MasonryFeed } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Button, Caption, Heading } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { getFeedPosts, routeId } from '@/lib/catalog';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { isVerifiedForProduct, useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

export default function ProductFeedScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const userPosts = useAppStore((state) => state.userPosts);
  const addPost = useAppStore((state) => state.addPost);
  const profile = useAppStore((state) => state.profile);
  const ownerships = useAppStore((state) => state.ownerships);
  const [sharing, setSharing] = useState(false);
  const [draft, setDraft] = useState('');

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }
  if (!product) return null;

  const posts = getFeedPosts(product.id, userPosts);
  const verified = isVerifiedForProduct(ownerships, product.id);

  return (
    <Screen
      footer={
        sharing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="A caption from real use. Honest criticism is welcome."
              placeholderTextColor={colors.inkSoft}
              multiline
              style={{
                minHeight: 72,
                backgroundColor: colors.white,
                borderColor: colors.mist,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: 12,
                fontFamily: fonts.regular,
                color: colors.ink,
              }}
            />
            <Button
              label="Share to feed"
              disabled={draft.trim().length < 8}
              onPress={() => {
                addPost({
                  productId: product.id,
                  authorName: profile?.displayName ?? 'You',
                  userId: profile?.id ?? 'anon',
                  type: 'feed_post',
                  body: draft.trim(),
                  photoUrl: 'tile:user',
                  traitTags:
                    profile?.skinType && profile.skinType !== 'unknown'
                      ? [SKIN_TYPE_LABEL[profile.skinType]]
                      : [],
                  isVerifiedOwner: verified,
                });
                setDraft('');
                setSharing(false);
              }}
            />
          </View>
        ) : (
          <Button label="+ Share your own" onPress={() => setSharing(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <View>
          <Heading size={16}>From the community</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>
      <Caption>Critical and glowing posts shown equally — nothing hidden, nothing boosted.</Caption>
      <MasonryFeed posts={posts} onPressPost={() => undefined} />
    </Screen>
  );
}
