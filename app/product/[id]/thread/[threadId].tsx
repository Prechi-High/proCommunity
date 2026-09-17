import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { YoutubeCommentCard } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Badge, Button, Caption, Heading, PostCard, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import {
  getSeedYoutubeComments,
  getThread,
  getThreadPosts,
  relatedPosts,
  routeId,
} from '@/lib/catalog';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { isVerifiedForProduct, useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';
import { loadProductVideos, loadYoutubeComments } from '@/lib/youtube';

export default function ThreadScreen() {
  const { id: rawId, threadId: rawThread } = useLocalSearchParams<{ id: string; threadId: string }>();
  const id = routeId(rawId);
  const threadId = routeId(rawThread);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const profile = useAppStore((state) => state.profile);
  const userPosts = useAppStore((state) => state.userPosts);
  const userThreads = useAppStore((state) => state.userThreads);
  const addPost = useAppStore((state) => state.addPost);
  const voteHelpful = useAppStore((state) => state.voteHelpful);
  const helpfulVotes = useAppStore((state) => state.helpfulVotes);
  const ownerships = useAppStore((state) => state.ownerships);
  const flagPost = useAppStore((state) => state.flagPost);
  const [draft, setDraft] = useState('');
  const [replying, setReplying] = useState(false);

  const thread = getThread(threadId, userThreads) ?? {
    id: threadId,
    productId: id,
    title: threadId.endsWith('-general') ? 'General discussion' : 'Discussion',
    createdBy: 'sourced',
    createdAt: new Date().toISOString(),
  };
  const posts = getThreadPosts(threadId, userPosts, id);
  const seedComments = getSeedYoutubeComments(id);
  const related = posts[0] ? relatedPosts(posts[0], userPosts) : [];

  const { data: clips = [] } = useQuery({
    queryKey: ['youtube', product?.brand, product?.name],
    queryFn: () => loadProductVideos(product!.name, product!.brand),
    enabled: Boolean(product),
    staleTime: 60 * 1000,
  });
  const firstVideo = clips[0]?.youtubeVideoId;
  const { data: liveComments = [] } = useQuery({
    queryKey: ['yt-comments', firstVideo],
    queryFn: () => loadYoutubeComments(firstVideo!),
    enabled: Boolean(firstVideo),
    staleTime: 10 * 60 * 1000,
  });

  const youtubeBootstrap = useMemo(() => {
    const live = liveComments.map((comment) => ({
      authorDisplayName: comment.authorDisplayName,
      body: comment.body,
    }));
    if (live.length) return live.slice(0, 3);
    return seedComments;
  }, [liveComments, seedComments]);

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
        replying ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Reply to this thread. No medical claims."
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
              label="Post"
              disabled={draft.trim().length < 8}
              onPress={() => {
                addPost({
                  productId: product.id,
                  threadId,
                  authorName: profile?.displayName ?? 'You',
                  userId: profile?.id ?? 'anon',
                  type: 'experience',
                  body: draft.trim(),
                  traitTags:
                    profile?.skinType && profile.skinType !== 'unknown'
                      ? [SKIN_TYPE_LABEL[profile.skinType]]
                      : [],
                  isVerifiedOwner: verified,
                });
                setDraft('');
                setReplying(false);
              }}
            />
          </View>
        ) : (
          <Button label="Reply to this thread" onPress={() => setReplying(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading size={16}>{thread.title}</Heading>
          <Caption>{product.name}</Caption>
        </View>
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

      {related.length ? (
        <View style={{ gap: 8 }}>
          <Title>Related — not a direct reply</Title>
          <Caption>Matched by overlapping words while this thread is still young.</Caption>
          {related.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      ) : null}

      {youtubeBootstrap.length ? (
        <View style={{ gap: 8 }}>
          <Title>Early conversation from YouTube</Title>
          <Caption>Labeled and separate from verified owners. This fades as Sourced posts grow.</Caption>
          {youtubeBootstrap.map((comment, index) => (
            <YoutubeCommentCard key={`${comment.authorDisplayName}-${index}`} comment={comment} />
          ))}
        </View>
      ) : null}

      {!posts.length ? (
        <View style={{ gap: 8 }}>
          <Badge label="New thread" />
          <Caption>No on-platform replies yet. Related posts and labeled YouTube comments keep this from looking abandoned.</Caption>
        </View>
      ) : null}
    </Screen>
  );
}
