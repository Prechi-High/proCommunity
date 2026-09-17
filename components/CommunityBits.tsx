import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts, radii } from '@/constants/theme';
import type { ThreadSummary } from '@/lib/catalog';
import { timeAgo } from '@/lib/catalog';
import type { CommunityPost, YoutubeComment } from '@/lib/types';

import { Badge, Caption, Title } from './ui';

const TILE_COLORS = [colors.honeySoft, colors.sageSoft, colors.rosewoodSoft, colors.mist];
const TILE_HEIGHTS = [108, 138, 92, 124];

export function MasonryFeed({
  posts,
  onPressPost,
}: {
  posts: CommunityPost[];
  onPressPost?: (post: CommunityPost) => void;
}) {
  const router = useRouter();
  const left = posts.filter((_, index) => index % 2 === 0);
  const right = posts.filter((_, index) => index % 2 === 1);

  const column = (columnPosts: CommunityPost[], offset: number) => (
    <View style={{ flex: 1, gap: 8 }}>
      {columnPosts.map((post, index) => {
        const i = offset + index * 2;
        return (
          <Pressable
            key={post.id}
            onPress={() =>
              onPressPost
                ? onPressPost(post)
                : router.push(`/product/${post.productId}/feed`)
            }
            style={{
              backgroundColor: colors.white,
              borderColor: colors.mist,
              borderWidth: 1,
              borderRadius: radii.card,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: TILE_HEIGHTS[i % TILE_HEIGHTS.length],
                backgroundColor: TILE_COLORS[i % TILE_COLORS.length],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>{post.isVerifiedOwner ? '📷' : '✦'}</Text>
            </View>
            <View style={{ padding: 10, gap: 6 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink, lineHeight: 16 }}>
                {`“${post.body}”`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                {post.isVerifiedOwner ? <Badge label="✓ Verified" tone="sage" /> : null}
                {post.traitTags.slice(0, 1).map((tag) => (
                  <Badge key={tag} label={tag} />
                ))}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  if (!posts.length) {
    return <Caption>No owner photos yet for this product. Critical and glowing posts will show equally.</Caption>;
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      {column(left, 0)}
      {column(right, 1)}
    </View>
  );
}

export function ThreadRow({ thread, productId }: { thread: ThreadSummary; productId: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/product/${productId}/thread/${thread.id}`)}
      style={{
        backgroundColor: colors.white,
        borderColor: colors.mist,
        borderWidth: 1,
        borderRadius: radii.card,
        padding: 12,
      }}
    >
      <Title>{thread.title}</Title>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft, marginTop: 4, lineHeight: 16 }}
      >
        {`“${thread.preview}”`}
      </Text>
      <Caption>{`${thread.replyCount} ${thread.replyCount === 1 ? 'reply' : 'replies'} · ${timeAgo(thread.lastActiveAt)}`}</Caption>
    </Pressable>
  );
}

export function YoutubeCommentCard({ comment }: { comment: Pick<YoutubeComment, 'authorDisplayName' | 'body'> }) {
  return (
    <View
      style={{
        backgroundColor: '#F7F4F1',
        borderColor: colors.mist,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: radii.card,
        padding: 12,
        gap: 6,
      }}
    >
      <Badge label="From a YouTube review" tone="neutral" />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>{comment.authorDisplayName}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.ink, lineHeight: 18 }}>{comment.body}</Text>
    </View>
  );
}
