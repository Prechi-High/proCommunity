import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import { Caption, Heading, Seg } from '@/components/ui';
import { ArrowRight } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { getProductThreads } from '@/lib/catalog';
import {
  SAMPLE_EXPERTS,
  SAMPLE_HERE,
  SAMPLE_JOURNEYS,
  SAMPLE_ROOMS,
  expertById,
  expertInitial,
} from '@/lib/communitySample';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { searchCatalog } from '@/lib/products';
import { useAppStore } from '@/lib/store';

type CommunitySeg = 'talk' | 'journeys' | 'experts';

/**
 * Community tab — Talk / Journeys / Experts, matching sourced-v1 (2).html.
 */
export default function CommunityScreen() {
  const router = useRouter();
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const following = useAppStore((s) => s.followingJourneyIds);
  const toggleFollow = useAppStore((s) => s.toggleFollowJourney);
  const reminders = useAppStore((s) => s.roomReminders);
  const toggleRemind = useAppStore((s) => s.toggleRoomRemind);
  const [seg, setSeg] = useState<CommunitySeg>('talk');

  const { data: products = [] } = useQuery({
    queryKey: ['community-products'],
    queryFn: () => searchCatalog('skincare'),
    staleTime: 5 * 60_000,
  });

  const live = SAMPLE_ROOMS.find((r) => r.live)!;
  const liveHost = expertById(live.hostId);
  const upcoming = SAMPLE_ROOMS.filter((r) => !r.live);

  const discussions = products.slice(0, 3).map((product) => {
    const threads = getProductThreads(product.id, userThreads, userPosts);
    const thread = threads[0];
    const ownerReplies = userPosts.filter(
      (p) => p.productId === product.id && p.isVerifiedOwner,
    ).length;
    return {
      productId: product.id,
      threadId: thread?.id,
      title: thread?.title ?? `Talk about ${product.name}`,
      replies: thread?.replyCount ?? 0,
      owners: ownerReplies,
      short: product.name.slice(0, 22),
      expert: Boolean(thread?.title),
    };
  });

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
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>
            {SAMPLE_HERE.toLocaleString()} here
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => {
          hapticTap();
          router.push(`/room/${live.id}` as Href);
        }}
        style={{
          marginTop: 16,
          backgroundColor: colors.lac,
          borderRadius: 26,
          padding: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.sage }}>Live now</Text>
        </View>
        <Text
          style={{
            marginTop: 10,
            fontFamily: fonts.serif,
            fontSize: 23,
            lineHeight: 26,
            fontWeight: '500',
            color: colors.bone,
            letterSpacing: -0.4,
          }}
        >
          {live.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <AvatarMark letter={expertInitial(liveHost.name)} expert />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>
              {liveHost.name}
            </Text>
            <Caption>
              {liveHost.role} · {live.listening} listening
            </Caption>
          </View>
        </View>
      </Pressable>

      <View style={{ marginTop: 18 }}>
        <Seg
          options={[
            { id: 'talk', label: 'Talk' },
            { id: 'journeys', label: 'Journeys' },
            { id: 'experts', label: 'Experts' },
          ]}
          value={seg}
          onChange={(id) => setSeg(id as CommunitySeg)}
        />
      </View>

      {seg === 'talk' ? (
        <View>
          <Pressable
            onPress={() => {
              hapticTap();
              router.push('/compose?kind=fear' as Href);
            }}
            style={{
              marginTop: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 21,
              paddingHorizontal: 22,
              borderRadius: 22,
              backgroundColor: colors.lac,
            }}
          >
            <Text style={{ fontFamily: fonts.regular, fontSize: 17, color: colors.bone2 }}>
              What’s on your mind?
            </Text>
            <ArrowRight size={22} color={colors.hi} weight="bold" />
          </Pressable>
          <View style={{ marginTop: 10 }}>
            <Caption>A worry, why you want something, or a question. Owners and experts reply.</Caption>
          </View>
          <View style={{ marginTop: 14 }}>
            {discussions.map((item) => (
              <Pressable
                key={`${item.productId}-${item.threadId}`}
                onPress={() => {
                  hapticTap();
                  if (item.threadId) {
                    router.push(`/product/${item.productId}/thread/${item.threadId}`);
                  } else {
                    router.push(`/product/${item.productId}/community`);
                  }
                }}
                style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.line }}
              >
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 21,
                    lineHeight: 25,
                    fontWeight: '500',
                    color: colors.bone,
                  }}
                >
                  “{item.title}”
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <Pill label={item.short} />
                  <Caption>
                    {item.replies} replies, {item.owners} from owners
                  </Caption>
                  {item.expert ? <Pill label="Expert replied" expert /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {seg === 'journeys' ? (
        <View>
          <Caption>
            Real people sharing progress week by week. Follow one to see every update.
          </Caption>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingVertical: 14 }}
          >
            {SAMPLE_JOURNEYS.map((j) => {
              const on = following.includes(j.id);
              return (
                <View
                  key={j.id}
                  style={{
                    width: 280,
                    backgroundColor: colors.lac,
                    borderRadius: 22,
                    padding: 16,
                  }}
                >
                  <View style={{ height: 110, borderRadius: 14, backgroundColor: colors.lac2 }} />
                  <Text
                    style={{
                      marginTop: 14,
                      fontFamily: fonts.serif,
                      fontSize: 22,
                      fontWeight: '500',
                      color: colors.bone,
                    }}
                  >
                    {j.name}
                  </Text>
                  <Caption>
                    {j.productLabel} · {j.skin} · {j.week}
                  </Caption>
                  <Text
                    style={{
                      marginTop: 9,
                      fontFamily: fonts.regular,
                      fontSize: 15,
                      lineHeight: 21,
                      color: colors.bone2,
                    }}
                  >
                    {j.cap}
                  </Text>
                  <View
                    style={{
                      marginTop: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Caption>
                      {j.followers + (on ? 1 : 0)} following
                    </Caption>
                    <Pressable
                      onPress={() => {
                        toggleFollow(j.id);
                        if (!on) hapticSuccess();
                        else hapticSelect();
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: on ? colors.bone : colors.lac2,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.semibold,
                          fontSize: 13,
                          color: on ? colors.wine : colors.bone,
                        }}
                      >
                        {on ? 'Following' : 'Follow'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {seg === 'experts' ? (
        <View>
          <Heading size={22} style={{ marginTop: 10 }}>
            Live sessions
          </Heading>
          {upcoming.map((r) => {
            const host = expertById(r.hostId);
            const on = Boolean(reminders[r.id]);
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                }}
              >
                <Pressable
                  onPress={() => {
                    hapticTap();
                    router.push(`/room/${r.id}` as Href);
                  }}
                  style={{ flex: 1 }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{r.title}</Text>
                  <Caption>
                    {host.name} · {r.when} · {r.going} going
                  </Caption>
                </Pressable>
                <Pressable
                  onPress={() => {
                    toggleRemind(r.id);
                    hapticSuccess();
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: on ? colors.bone : colors.lac2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      color: on ? colors.wine : colors.bone2,
                    }}
                  >
                    {on ? 'Reminder set' : 'Remind me'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Heading size={22} style={{ marginTop: 30 }}>
            Ask an expert
          </Heading>
          <Caption>Verified professionals. General information, not medical advice.</Caption>
          {SAMPLE_EXPERTS.map((e) => (
            <View
              key={e.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <AvatarMark letter={expertInitial(e.name)} expert />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{e.name}</Text>
                <Caption>
                  {e.role} · {e.cred}
                  {'\n'}
                  {e.topic}
                </Caption>
              </View>
              <Pressable
                onPress={() => {
                  hapticTap();
                  router.push(`/compose?kind=question&expert=${e.id}` as Href);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: colors.lac2,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>Ask</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 26 }}>
        <Caption>Live figures on this prototype are sample numbers.</Caption>
      </View>
    </Screen>
  );
}

function AvatarMark({ letter, expert }: { letter: string; expert?: boolean }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: expert ? 'rgba(232,185,90,0.2)' : colors.lac2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.serif, fontSize: 19, color: expert ? colors.honey : colors.bone }}>
        {letter}
      </Text>
    </View>
  );
}

function Pill({ label, expert }: { label: string; expert?: boolean }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: expert ? colors.honey : colors.line,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 12,
          color: expert ? colors.honey : colors.bone2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
