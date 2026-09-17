import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { MasonryFeed } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Button, Caption, Heading, Notice } from '@/components/ui';
import { BackButton, Camera, Plus, Scales } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { getFeedPosts, routeId } from '@/lib/catalog';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { isVerifiedForProduct, useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

/** 04b, scoped to one product. Same restraint: no ranking, no boosting. */
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
              placeholder="What actually happened? Honest criticism is welcome here."
              placeholderTextColor={colors.inkSoft}
              multiline
              style={{
                minHeight: 76,
                backgroundColor: colors.white,
                borderColor: colors.mist,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: 12,
                fontFamily: fonts.regular,
                fontSize: 14,
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
                  photoUrl: null,
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
          <Button label="Share what happened for you" icon={Plus} onPress={() => setSharing(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Heading size={18}>What it looked like</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Scales size={13} color={colors.inkSoft} weight="regular" />
        <Caption>{`${posts.length} posts, newest first. Nothing hidden, nothing boosted.`}</Caption>
      </View>

      <MasonryFeed posts={posts} onPressPost={() => undefined} />

      {sharing ? (
        <Notice quiet icon={Camera}>
          Photo upload arrives with Supabase Storage. Until then a post without a photo shows as a quote
          card rather than borrowing someone else's picture.
        </Notice>
      ) : null}
    </Screen>
  );
}
