import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Badge, Caption, Card, Chip, Heading, Title } from '@/components/ui';
import { colors } from '@/constants/theme';
import { getAuthor, getAuthorPosts, getProduct, routeId } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';

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
        <Heading>Profile not found</Heading>
      </Screen>
    );
  }

  const productsUsed = new Set(posts.map((post) => post.productId)).size;

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
      </Pressable>
      <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.mist,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28 }}>👤</Text>
        </View>
        <Title>{author.displayName}</Title>
        <Caption>{`Member since ${new Date(author.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}</Caption>
        {author.verified ? <Badge label="✓ Verified owner" tone="sage" /> : null}
      </View>
      <View style={{ height: 1, backgroundColor: colors.mist }} />
      <Heading size={16}>Known for</Heading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {author.knownFor.length === 0 ? (
          <Caption>No category reputation yet.</Caption>
        ) : (
          author.knownFor.map((item) => (
            <Chip key={item.tag} label={`${item.tag} · ${item.answers} answers`} />
          ))
        )}
      </View>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Title>{String(posts.length)}</Title>
            <Caption>Answers</Caption>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Title>{String(productsUsed)}</Title>
            <Caption>Products used</Caption>
          </View>
        </View>
      </Card>
      <Heading size={16}>Recent contributions</Heading>
      {posts.slice(0, 6).map((post) => {
        const product = getProduct(post.productId);
        return (
          <Pressable key={post.id} onPress={() => router.push(`/product/${post.productId}/community`)}>
            <Card>
              <Caption color={colors.ink}>{`"${post.body}"`}</Caption>
              <Caption>{`On ${product?.name ?? 'a product'} · ↑ ${post.helpfulCount}`}</Caption>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
