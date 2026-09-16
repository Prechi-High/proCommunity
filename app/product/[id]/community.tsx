import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Chip, Disclaimer, Heading, PostCard } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { getProductPosts, routeId } from '@/lib/catalog';
import { useProduct } from '@/lib/useProduct';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { isVerifiedForProduct, useAppStore } from '@/lib/store';

type Filter = 'like-me' | 'newest' | 'questions';

export default function CommunityScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const addPost = useAppStore((s) => s.addPost);
  const voteHelpful = useAppStore((s) => s.voteHelpful);
  const helpfulVotes = useAppStore((s) => s.helpfulVotes);
  const ownerships = useAppStore((s) => s.ownerships);
  const flagPost = useAppStore((s) => s.flagPost);
  const [filter, setFilter] = useState<Filter>('like-me');
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);

  const posts = useMemo(() => {
    const all = getProductPosts(id, userPosts);
    if (filter === 'questions') return all.filter((post) => post.type === 'question');
    if (filter === 'newest') return all;
    if (profile?.skinType && profile.skinType !== 'unknown') {
      const mine = all.filter((post) =>
        post.traitTags.join(' ').toLowerCase().includes(profile.skinType === 'combination' ? 'combo' : profile.skinType),
      );
      return mine.length ? mine : all;
    }
    return all;
  }, [id, userPosts, filter, profile]);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }

  if (!product) return null;
  const verified = isVerifiedForProduct(ownerships, product.id);

  return (
    <Screen
      footer={
        asking ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask something specific. No medical claims."
              placeholderTextColor={colors.inkSoft}
              multiline
              style={{
                minHeight: 80,
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
              label="Post question"
              disabled={draft.trim().length < 8}
              onPress={() => {
                addPost({
                  productId: product.id,
                  authorName: profile?.displayName ?? 'You',
                  userId: profile?.id ?? 'anon',
                  type: 'question',
                  body: draft.trim(),
                  traitTags: profile?.skinType && profile.skinType !== 'unknown' ? [SKIN_TYPE_LABEL[profile.skinType]] : [],
                  isVerifiedOwner: verified,
                });
                setDraft('');
                setAsking(false);
              }}
            />
          </View>
        ) : (
          <Button label="Ask a question" onPress={() => setAsking(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <View>
          <Heading size={16}>Community</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Like me" selected={filter === 'like-me'} onPress={() => setFilter('like-me')} />
        <Chip label="Newest" selected={filter === 'newest'} onPress={() => setFilter('newest')} />
        <Chip label="Questions" selected={filter === 'questions'} onPress={() => setFilter('questions')} />
      </View>
      {posts.map((post) => (
        <Pressable
          key={post.id}
          onLongPress={() => {
            flagPost(post.id);
            Alert.alert('Flagged for review', 'A moderator will look at this post.');
          }}
        >
          <PostCard
            post={post}
            highlightQuestion
            voted={helpfulVotes.includes(post.id)}
            onHelpful={() => voteHelpful(post.id)}
          />
        </Pressable>
      ))}
      {posts.length === 0 ? (
        <Caption>
          No posts in this filter yet. Seeded discussion appears as real people start using the catalog.
        </Caption>
      ) : null}
      <Disclaimer compact />
    </Screen>
  );
}
