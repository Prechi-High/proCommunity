import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { colors, elevation, fonts, radii, scrimGradient } from '@/constants/theme';
import { ArrowFatUp, ChatsCircle, SealCheck, YoutubeLogo } from '@/components/icons';
import type { ThreadSummary } from '@/lib/catalog';
import { getAuthor, timeAgo } from '@/lib/catalog';
import type { CommunityPost, YoutubeComment } from '@/lib/types';

import { Avatar, Caption, QuoteTile } from './ui';

/** Uneven tile heights are what make a masonry grid worth scrolling. */
const TILE_HEIGHTS = [228, 168, 196, 248, 184, 156];

/**
 * 04b — Discovery Feed.
 *
 * Photographs first, text second: the pull here should be "let me see one
 * more", which only works if there is something to look at. Order is strictly
 * newest-first, so a critical post sits beside a glowing one exactly as often
 * as it really occurs.
 */
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
    <View style={{ flex: 1, gap: 10 }}>
      {columnPosts.map((post, index) => (
        <FeedTile
          key={post.id}
          post={post}
          height={TILE_HEIGHTS[(offset + index * 2) % TILE_HEIGHTS.length]}
          onPress={() =>
            onPressPost ? onPressPost(post) : router.push(`/product/${post.productId}/feed`)
          }
        />
      ))}
    </View>
  );

  if (!posts.length) {
    return (
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
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
          Nobody has posted a photo here yet
        </Text>
        <Caption>
          When they do, glowing and critical posts appear in the same order they were written.
        </Caption>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      {column(left, 0)}
      {column(right, 1)}
    </View>
  );
}

function FeedTile({
  post,
  height,
  onPress,
}: {
  post: CommunityPost;
  height: number;
  onPress: () => void;
}) {
  const author = getAuthor(post.userId);
  const hasPhoto = Boolean(post.photoUrl);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${post.authorName}: ${post.body}`}
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: radii.photo,
          overflow: 'hidden',
        },
        elevation.raised,
      ]}
    >
      {hasPhoto ? (
        <View style={{ height }}>
          <Image
            source={{ uri: post.photoUrl! }}
            style={{ width: '100%', height }}
            resizeMode="cover"
          />
          {/* Fades across the lower third, so the photograph stays the subject. */}
          <LinearGradient
            colors={scrimGradient.soft}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 76 }}
          />
          <View
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Avatar userId={post.userId} name={post.authorName} uri={author?.avatarUrl} size={24} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.white }}
            >
              {post.authorName}
            </Text>
            {post.isVerifiedOwner ? <SealCheck size={14} color={colors.white} weight="fill" /> : null}
          </View>
        </View>
      ) : (
        <QuoteTile body={post.body} height={height} />
      )}

      <View style={{ padding: 11, gap: 7 }}>
        {hasPhoto ? (
          <Text
            numberOfLines={3}
            style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17.5, color: colors.ink }}
          >
            {post.body}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ArrowFatUp size={11} color={colors.inkSoft} weight="regular" />
            <Caption>{String(post.helpfulCount)}</Caption>
          </View>
          {post.traitTags[0] ? <Caption>{`· ${post.traitTags[0]}`}</Caption> : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 06 — a row in the threads list.
 *
 * The title does the work: someone should be able to recognise their exact
 * question in it and feel the relief of "there's literally a thread for this".
 */
export function ThreadRow({ thread, productId }: { thread: ThreadSummary; productId: string }) {
  const router = useRouter();
  const empty = thread.replyCount === 0;

  return (
    <Pressable
      onPress={() => router.push(`/product/${productId}/thread/${thread.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${thread.title}, ${thread.replyCount} ${thread.replyCount === 1 ? 'reply' : 'replies'}`}
      style={[
        {
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radii.card,
          padding: 14,
          gap: 8,
        },
        elevation.raised,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 15,
          lineHeight: 20,
          color: colors.ink,
          letterSpacing: -0.25,
        }}
      >
        {thread.title}
      </Text>

      {empty ? (
        <Caption>No replies yet — yours would be the first.</Caption>
      ) : (
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft, lineHeight: 17.5 }}
        >
          {thread.preview}
        </Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ChatsCircle size={13} color={colors.rosewood} weight="regular" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.rosewood }}>
          {`${thread.replyCount} ${thread.replyCount === 1 ? 'reply' : 'replies'}`}
        </Text>
        <Caption>{`· ${timeAgo(thread.lastActiveAt)}`}</Caption>
      </View>
    </Pressable>
  );
}

/**
 * 06b — borrowed content.
 *
 * Deliberately built to look unlike a Sourced reply: dashed edge, tinted
 * ground, platform mark. Someone should never have to wonder whether this was
 * a real owner answering them.
 */
export function YoutubeCommentCard({
  comment,
}: {
  comment: Pick<YoutubeComment, 'authorDisplayName' | 'body'>;
}) {
  return (
    <View
      style={{
        backgroundColor: '#F7F4F1',
        borderColor: colors.mist,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: radii.card,
        padding: 13,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <YoutubeLogo size={15} color={colors.inkSoft} weight="fill" />
        <Text
          style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5 }}
        >
          FROM A YOUTUBE REVIEW · NOT A SOURCED OWNER
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.ink, lineHeight: 19 }}>
        {comment.body}
      </Text>
      <Caption>{comment.authorDisplayName}</Caption>
    </View>
  );
}
