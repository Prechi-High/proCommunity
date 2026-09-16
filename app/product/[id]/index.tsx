import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart } from 'phosphor-react-native';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Disclaimer,
  Heading,
  ScoreRing,
  Thumb,
  Title,
} from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { getLiteracyForProduct, getProductPosts, routeId, tagLabel } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { isVerifiedForProduct, useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';
import { loadProductVideos } from '@/lib/youtube';

export default function ProductDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const markPurchased = useAppStore((s) => s.markPurchased);
  const ownerships = useAppStore((s) => s.ownerships);
  const addRoutineStep = useAppStore((s) => s.addRoutineStep);
  const [scoreOpen, setScoreOpen] = useState(false);
  const { data: clips = [], isFetching: videosLoading } = useQuery({
    queryKey: ['youtube', product?.brand, product?.name],
    queryFn: () => loadProductVideos(product!.name, product!.brand),
    enabled: Boolean(product),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (product) track('product_viewed', { productId: product.id, source: product.source });
  }, [product]);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen>
        <Heading>Product not found</Heading>
        <Button label="Back to search" onPress={() => router.back()} />
      </Screen>
    );
  }

  const posts = getProductPosts(product.id, userPosts);
  const breakdown = computeConfidence(product, profile, posts);
  const literacy = getLiteracyForProduct(product);
  const saved = favorites.some((item) => item.productId === product.id);
  const owned = ownerships.some((item) => item.productId === product.id);
  const verified = isVerifiedForProduct(ownerships, product.id);
  const preview = posts.filter((post) => post.type !== 'question').slice(0, 2);

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Button label="Get This Product" onPress={() => router.push(`/product/${product.id}/stores`)} />
          </View>
          <Pressable
            onPress={() => toggleFavorite(product.id)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.mist,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.white,
            }}
          >
            <Heart size={22} color={saved ? colors.rosewood : colors.ink} weight={saved ? 'fill' : 'regular'} />
          </Pressable>
        </View>
      }
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
      </Pressable>
      <View
        style={{
          height: 160,
          borderRadius: radii.card,
          backgroundColor: colors.mist,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {product.heroImageUrl ? (
          <Image source={{ uri: product.heroImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 56 }}>{product.heroEmoji}</Text>
        )}
      </View>
      <View>
        <Caption>{product.brand.toUpperCase()}</Caption>
        <Heading size={20}>{product.name}</Heading>
        {product.source === 'open_beauty_facts' ? (
          <Caption>Open Beauty Facts · community-sourced ingredients</Caption>
        ) : null}
      </View>

      <Pressable onPress={() => setScoreOpen((value) => !value)}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <ScoreRing score={breakdown.compositeScore} />
            <View style={{ flex: 1, gap: 4 }}>
              <Title>
                {breakdown.tooFewReviews ? 'Not a full score yet' : `${breakdown.headline} for you`}
              </Title>
              <Caption>{breakdown.explanation}</Caption>
            </View>
          </View>
          {scoreOpen ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Caption>{`Fit match · ${breakdown.fitMatchScore} — ${breakdown.fitLabel}`}</Caption>
              <Caption>
                {`Community · ${breakdown.sentimentScore ?? '—'} — ${breakdown.sentimentLabel}`}
              </Caption>
              <Caption>{`Transparency · ${breakdown.transparencyScore} — ${breakdown.transparencyLabel}`}</Caption>
            </View>
          ) : (
            <Caption color={colors.rosewood}>Tap to see the three parts of this score</Caption>
          )}
        </Card>
      </Pressable>

      <View>
        <Heading size={16}>What's in it</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {product.ingredients.slice(0, 4).map((tag) => (
            <Chip key={tag} label={tagLabel(tag)} />
          ))}
          {product.attributeTags.slice(0, 3).map((tag) => (
            <Chip key={tag} label={tagLabel(tag)} />
          ))}
        </View>
        <View style={{ marginTop: 10 }}>
          <Body>{literacy[0]?.body ?? (product.description || 'Ingredient details are still being completed for this product.')}</Body>
        </View>
      </View>

      {videosLoading || clips.length ? (
        <View style={{ gap: 8 }}>
          <Heading size={16}>Watch</Heading>
          {videosLoading && !clips.length ? (
            <Caption>Looking up reviews on YouTube…</Caption>
          ) : null}
          {clips.slice(0, 3).map((clip) => (
            <Pressable
              key={clip.youtubeVideoId}
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${clip.youtubeVideoId}`)}
            >
              <Card>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {clip.thumbnailUrl ? (
                    <Image
                      source={{ uri: clip.thumbnailUrl }}
                      style={{ width: 72, height: 48, borderRadius: 8, backgroundColor: colors.mist }}
                    />
                  ) : (
                    <Thumb emoji="▶" size={48} />
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Title>{clip.title}</Title>
                    <Caption>{clip.channelTitle}</Caption>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Disclaimer />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Heading size={16}>Community</Heading>
        <Pressable onPress={() => router.push(`/product/${product.id}/community`)}>
          <Caption color={colors.rosewood}>{`View all ${posts.length}`}</Caption>
        </Pressable>
      </View>
      {preview.map((post) => (
        <Pressable key={post.id} onPress={() => router.push(`/product/${product.id}/community`)}>
          <Card>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Thumb emoji="👤" size={34} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                  {post.isVerifiedOwner ? <Badge label="✓ Verified" tone="sage" /> : null}
                  {post.traitTags.map((tag) => (
                    <Badge key={tag} label={tag} />
                  ))}
                </View>
                <Caption color={colors.ink}>{post.body}</Caption>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}

      <Button
        label={owned ? (verified ? 'Eligible to post as verified' : 'Purchase marked — waiting period') : 'I bought this'}
        kind="outline"
        onPress={() => markPurchased(product.id)}
      />
      <Button
        label="Add to morning routine"
        kind="text"
        onPress={() => {
          markPurchased(product.id);
          addRoutineStep(product.id, 'am');
          router.push('/routine');
        }}
      />
      <Button
        label="Progress journal"
        kind="text"
        onPress={() => router.push(`/product/${product.id}/progress`)}
      />
    </Screen>
  );
}
