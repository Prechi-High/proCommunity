import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import {
  Avatar,
  Caption,
  Card,
  Eyebrow,
  Heading,
  SectionHeader,
  StatBlock,
  Title,
  VerifiedBadge,
} from '@/components/ui';
import { ArrowFatUp, BackButton, CaretRight, HandHeart, Quotes } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { getAuthor, getAuthorPosts, getProduct, routeId } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';

/**
 * 09 — Verified owner profile.
 *
 * "Known for" is the headline, above any count, because being known for oily
 * skin specifically is an identity — and identity sustains contribution in a
 * way a global score never does. There is deliberately no rank, no position,
 * and no comparison to another member anywhere on this screen.
 */
export default function UserProfileScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const userPosts = useAppStore((s) => s.userPosts);
  const author = getAuthor(id);
  const posts = getAuthorPosts(id, userPosts);

  if (!author) {
    return (
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Heading size={18}>Profile not found</Heading>
        </View>
      </Screen>
    );
  }

  const productsUsed = new Set(posts.map((post) => post.productId)).size;
  const helpfulTotal = posts.reduce((sum, post) => sum + post.helpfulCount, 0);
  const since = new Date(author.memberSince).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
      </View>

      <View style={{ alignItems: 'center', gap: 9, paddingTop: 4 }}>
        <Avatar uri={author.avatarUrl} name={author.displayName} size={88} verified={author.verified} />
        <Heading size={21}>{author.displayName}</Heading>
        {author.verified ? <VerifiedBadge /> : null}
        <Caption>{`Member since ${since}`}</Caption>
      </View>

      {/* The identity claim, first and largest. */}
      {author.knownFor.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HandHeart size={14} color={colors.rosewood} weight="fill" />
            <Eyebrow color={colors.rosewood}>People come to them for</Eyebrow>
          </View>
          {author.knownFor.map((item) => (
            <View
              key={item.tag}
              style={{
                backgroundColor: colors.rosewoodSoft,
                borderRadius: radii.card,
                paddingHorizontal: 14,
                paddingVertical: 13,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 17,
                  color: colors.ink,
                  letterSpacing: -0.3,
                }}
              >
                {item.tag}
              </Text>
              <Caption>{`${item.answers} answers other people found useful`}</Caption>
            </View>
          ))}
        </View>
      ) : (
        <Card style={{ gap: 4 }}>
          <Title>No specialism yet</Title>
          <Caption>
            Reputation here is earned per category — answer questions about one thing and it starts
            showing up above.
          </Caption>
        </Card>
      )}

      {/* Counts live below the identity, and are never compared to anyone. */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatBlock value={String(posts.length)} label="Answers" />
          <StatBlock value={String(productsUsed)} label="Products used" />
          <StatBlock value={String(helpfulTotal)} label="Found helpful" />
        </View>
      </Card>

      <SectionHeader title="Recent contributions" />
      {posts.slice(0, 6).map((post) => {
        const product = getProduct(post.productId);
        return (
          <Pressable
            key={post.id}
            onPress={() => router.push(`/product/${post.productId}/community`)}
          >
            <Card style={{ gap: 9 }}>
              <Quotes size={14} color={colors.mist} weight="fill" />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink }}>
                {post.body}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ArrowFatUp size={11} color={colors.inkSoft} weight="regular" />
                <Caption>{`${post.helpfulCount} · on ${product?.name ?? 'a product'}`}</Caption>
                <View style={{ flex: 1 }} />
                <CaretRight size={12} color={colors.mist} weight="bold" />
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
