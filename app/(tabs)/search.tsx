import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Caption, Chip, Heading } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getFeedPosts, getProduct, getProductThreads } from '@/lib/catalog';
import { searchCatalog } from '@/lib/products';
import { useAppStore } from '@/lib/store';

/**
 * Community tab — exact sourced-v1 structure with live threads/posts.
 */
export default function CommunityScreen() {
  const router = useRouter();
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const here = 1284;

  const { data: products = [] } = useQuery({
    queryKey: ['community-products'],
    queryFn: () => searchCatalog('skincare'),
    staleTime: 5 * 60_000,
  });

  const feed = getFeedPosts(undefined, userPosts);
  const questions = feed.filter((p) => p.type === 'question').slice(0, 4);
  const discussions =
    questions.length > 0
      ? questions
      : products.slice(0, 4).map((p) => {
          const threads = getProductThreads(p.id, userThreads, userPosts);
          return {
            id: threads[0]?.id ?? p.id,
            productId: p.id,
            body: threads[0]?.title ?? `Talk about ${p.name}`,
            authorName: 'Community',
            isVerifiedOwner: false,
            type: 'question' as const,
          };
        });

  const liveTitle = 'Building a routine for oily skin';

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          gap: 12,
        }}
      >
        <Heading size={34}>Community</Heading>
        <LiveTiny count={here} />
      </View>
      <Caption color={colors.bone2}>
        People testing, questioning and sharing right now. You’re not doing this alone.
      </Caption>

      <Pressable
        onPress={() => products[0] && router.push(`/product/${products[0].id}/community`)}
        style={{
          marginTop: 20,
          backgroundColor: colors.lac,
          borderRadius: 26,
          padding: 20,
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PulseDot />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.sage }}>Live now</Text>
        </View>
        <Text
          style={{
            marginTop: 12,
            fontFamily: fonts.serif,
            fontSize: 26,
            lineHeight: 29,
            letterSpacing: -0.5,
            color: colors.bone,
            fontWeight: '500',
          }}
        >
          {liveTitle}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(232,185,90,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.serif, fontSize: 19, color: colors.honey }}>L</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Dr. Lena Okafor</Text>
            <Caption>Dermatologist · 47 listening</Caption>
          </View>
        </View>
        <View
          style={{
            marginTop: 18,
            backgroundColor: colors.hi,
            borderRadius: 16,
            paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.wine }}>Join the room</Text>
        </View>
      </Pressable>

      <View
        style={{
          marginTop: 22,
          backgroundColor: colors.lac,
          borderRadius: 26,
          padding: 22,
        }}
      >
        <Text style={{ fontFamily: fonts.serif, fontSize: 25, fontWeight: '500', color: colors.bone }}>
          Got a worry?
        </Text>
        <Caption color={colors.bone2}>
          Share your fear about a product, or why you want it. People who’ve used it, and experts, will reply.
        </Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <Chip label="My fear" onPress={() => router.push('/(tabs)' as Href)} />
          <Chip label="Why I want it" onPress={() => router.push('/(tabs)' as Href)} />
          <Chip label="A question" onPress={() => router.push('/(tabs)' as Href)} />
        </View>
      </View>

      <View style={{ marginTop: 34 }}>
        <Heading size={27}>Discussions</Heading>
        <Caption color={colors.bone2}>Happening across every product.</Caption>
        {discussions.map((item) => {
          const product = getProduct(item.productId);
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/product/${item.productId}/community`)}
              style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.line }}
            >
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 21,
                  lineHeight: 25,
                  color: colors.bone,
                  fontWeight: '500',
                }}
              >
                “{item.body.slice(0, 80)}
                {item.body.length > 80 ? '…' : ''}”
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                {product ? <Pill label={product.name.slice(0, 24)} /> : null}
                <Caption>from the community</Caption>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 34, marginBottom: 12 }}>
        <Heading size={27}>Journeys to follow</Heading>
        <Caption color={colors.bone2}>
          Real people sharing progress. Open a case file and follow owners from there.
        </Caption>
        <Pressable
          onPress={() => products[0] && router.push(`/probe/${products[0].id}`)}
          style={{
            marginTop: 14,
            paddingVertical: 15,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>
            {products[0]?.name ?? 'Open a case'}
          </Text>
          <Caption>Investigate to see journeys and owner updates</Caption>
        </Pressable>
      </View>

      <Caption>Live presence counts are approximate while the room feature is in preview.</Caption>
    </Screen>
  );
}

function LiveTiny({ count }: { count: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(243,235,226,0.07)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <PulseDot />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>
        {count.toLocaleString()} here
      </Text>
    </View>
  );
}

function PulseDot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />;
}

function Pill({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone2 }}>{label}</Text>
    </View>
  );
}
