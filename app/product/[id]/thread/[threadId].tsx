import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { YoutubeCommentCard } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Button, Caption, Heading, PostCard, Title } from '@/components/ui';
import { BackButton, ChatsCircle, HandHeart, Sparkle, YoutubeLogo } from '@/components/icons';
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

/**
 * 06b — Thread detail.
 *
 * Two things have to happen at once. Someone should feel accompanied ("other
 * people wondered exactly this"), and they should be able to tell, without
 * effort, which of the things on screen is a real reply, which we surfaced by
 * matching words, and which we borrowed from YouTube. The three are given
 * visibly different containers and explicit headers — the moment the borrowed
 * content could pass as a genuine answer, the validation turns into suspicion.
 */
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
      replies: (comment.replies ?? []).map((reply) => ({
        authorDisplayName: reply.authorDisplayName,
        body: reply.body,
      })),
    }));
    if (live.length) return live.slice(0, 3);
    return seedComments.map((comment) => ({
      authorDisplayName: comment.authorDisplayName,
      body: comment.body,
      replies: comment.replies?.map((reply) => ({
        authorDisplayName: reply.authorDisplayName,
        body: reply.body,
      })),
    }));
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
  const voices = new Set(posts.map((post) => post.userId)).size;

  return (
    <Screen
      footer={
        replying ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="What happened when you used it? No medical claims, please."
              placeholderTextColor={colors.inkSoft}
              multiline
              style={{
                minHeight: 84,
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
              label="Post reply"
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
          <Button label="Add your experience" icon={HandHeart} onPress={() => setReplying(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1, gap: 3 }}>
          <Heading size={19}>{thread.title}</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>

      {/* "Someone else asked exactly this" — stated plainly, with a real count. */}
      {posts.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <ChatsCircle size={13} color={colors.sage} weight="fill" />
          <Caption color={colors.sage}>
            {`${voices} ${voices === 1 ? 'person has' : 'people have'} been here before you`}
          </Caption>
        </View>
      ) : null}

      {posts.length ? (
        <View style={{ gap: 10 }}>
          <SourceHeader
            icon={ChatsCircle}
            label="Replies from Sourced members"
            note="Written here, by people with an account."
            tone={colors.sage}
          />
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
                onPressAuthor={() => router.push(`/user/${post.userId}`)}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <View
          style={{
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: colors.mist,
            borderStyle: 'dashed',
            padding: 16,
            gap: 4,
          }}
        >
          <Title>Nobody has replied here yet</Title>
          <Caption>
            Below is everything we could find that is close to this question. None of it is a reply —
            it is labelled so you can weigh it properly.
          </Caption>
        </View>
      )}

      {related.length ? (
        <View style={{ gap: 10 }}>
          <SourceHeader
            icon={Sparkle}
            label="Surfaced by us — not replies"
            note="Other posts on this product that share wording with this question."
            tone={colors.honey}
          />
          {related.map((post) => (
            <View
              key={post.id}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: colors.honey,
                borderRadius: 4,
                paddingLeft: 8,
              }}
            >
              <PostCard post={post} onPressAuthor={() => router.push(`/user/${post.userId}`)} />
            </View>
          ))}
        </View>
      ) : null}

      {youtubeBootstrap.length ? (
        <View style={{ gap: 10 }}>
          <SourceHeader
            icon={YoutubeLogo}
            label="Borrowed from YouTube"
            note="Not written here and not verified. Shown so a new thread isn't empty; it fades as replies arrive."
            tone={colors.inkSoft}
          />
          {youtubeBootstrap.map((comment, index) => (
            <YoutubeCommentCard key={`${comment.authorDisplayName}-${index}`} comment={comment} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

/** Each provenance class gets the same header shape, so the distinction is learnable. */
function SourceHeader({
  icon: IconCmp,
  label,
  note,
  tone,
}: {
  icon: typeof ChatsCircle;
  label: string;
  note: string;
  tone: string;
}) {
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconCmp size={13} color={tone} weight="fill" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: tone, letterSpacing: 0.7 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Caption>{note}</Caption>
    </View>
  );
}
