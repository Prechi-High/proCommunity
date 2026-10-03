import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, PillTabs } from '@/components/community';
import { ArrowLeft, CaretRight, ChatCircle, SealCheck, ThumbsUp } from '@/components/icons';
import { PrimaryButton, ProductImage, Shimmer } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { KIND_LABEL, timeAgo } from '@/lib/community';
import { hapticTap } from '@/lib/haptics';
import { fetchMember, type MemberReply, type MemberThread, type OwnedProduct } from '@/lib/owners';
import { useAppStore } from '@/lib/store';
import type { OwnershipNote, ThreadKind } from '@/lib/types';

type Tab = 'notes' | 'answers' | 'posts';

export default function MemberScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeId(params.id);
  const myId = useAppStore((s) => s.profile?.id);
  const isMe = Boolean(myId && myId === id);
  const [tab, setTab] = useState<Tab>('notes');

  const member = useQuery({ queryKey: ['member', id], queryFn: () => fetchMember(id), enabled: Boolean(id), staleTime: 60_000, retry: 1 });
  const m = member.data ?? null;

  const openProduct = (pid: string, name: string) => router.push({ pathname: '/product/[id]', params: { id: pid, q: name } } as Href);
  const openThread = (tid: string) => router.push({ pathname: '/thread/[id]', params: { id: tid } } as Href);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back"
          hitSlop={8}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{isMe ? 'Your profile' : 'Member'}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>
        {member.isLoading ? (
          <View style={{ gap: 14, paddingTop: 10 }}>
            <Shimmer height={120} radius={22} />
            <Shimmer height={150} radius={20} />
            <Shimmer height={90} radius={18} />
          </View>
        ) : !m ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 60 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>This profile isn’t available</Text>
            <PrimaryButton label="Try again" onPress={() => void member.refetch()} />
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
              <Avatar name={m.name} size={76} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.6, color: colors.bone }}>{m.name}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.hiInk }}>{isMe ? 'Your verified shelf' : `${m.name.split(' ')[0]}’s verified shelf`}</Text>
              {m.joinedAt ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone3 }}>Member since {new Date(m.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Stat value={m.stats.verified} label={m.stats.verified === 1 ? 'Verified product' : 'Verified products'} />
                <Stat value={m.stats.notes} label={m.stats.notes === 1 ? 'Ownership Note' : 'Ownership Notes'} />
                <Stat value={m.stats.helpful} label="Found helpful" />
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SealCheck size={20} color={colors.hi} weight="fill" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone }}>Verified owner of</Text>
              </View>
              {m.owned.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {m.owned.map((o) => (
                    <OwnedCard
                      key={o.productId}
                      item={o}
                      notes={m.notes.filter((n) => n.product_id === o.productId)}
                      onPress={() => openProduct(o.productId, o.productName)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={{ backgroundColor: colors.lac, borderRadius: 18, padding: 16, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{isMe ? 'Nothing verified yet' : 'No verified products yet'}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
                    {isMe
                      ? 'Open a product you own and tap “I own this” to verify it with a quick photo. Your answers about it will carry the mark.'
                      : 'Verified owners proved they own a product with a live photo in Unmask.'}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ gap: 12 }}>
              <PillTabs<Tab>
                options={[
                  { id: 'notes', label: 'Notes', count: m.notes.length },
                  { id: 'answers', label: 'Answers', count: m.replies.length },
                  { id: 'posts', label: 'Posts', count: m.threads.length },
                ]}
                value={tab}
                onChange={setTab}
              />
              {tab === 'notes' ? (
                m.notes.length ? (
                  m.notes.map((n) => <NoteRow key={n.id} note={n} onProduct={() => openProduct(n.product_id, n.product_name)} />)
                ) : (
                  <Empty text={isMe ? 'Your Ownership Notes show up here after you verify a product and tell people how it actually lived with you.' : 'No Ownership Notes yet.'} />
                )
              ) : tab === 'answers' ? (
                m.replies.length ? (
                  m.replies.map((r) => <AnswerRow key={r.id} reply={r} onPress={() => openThread(r.thread_id)} />)
                ) : (
                  <Empty text={isMe ? 'Your answers to other people’s questions show up here.' : 'No answers yet.'} />
                )
              ) : m.threads.length ? (
                m.threads.map((t) => <PostRow key={t.id} thread={t} onPress={() => openThread(t.id)} />)
              ) : (
                <Empty text={isMe ? 'Questions and reviews you post show up here.' : 'No posts yet.'} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 96, backgroundColor: colors.lac, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.bone }}>{value}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function OwnedCard({ item, notes, onPress }: { item: OwnedProduct; notes: OwnershipNote[]; onPress: () => void }) {
  const latest = notes[0];
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ width: 150, backgroundColor: colors.lac, borderRadius: 18, padding: 12, gap: 8, opacity: pressed ? 0.8 : 1 })}
    >
      <View>
        <ProductImage uri={item.productImage} category={item.category ?? ''} size={126} radius={14} />
        <View style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <SealCheck size={17} color={colors.hi} weight="fill" />
        </View>
      </View>
      <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: colors.bone }}>{item.productName}</Text>
      <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.bone3 }}>
        {notes.length ? `${notes.length} Ownership ${notes.length === 1 ? 'Note' : 'Notes'}${latest?.used_duration ? ` · ${latest.used_duration}` : ''}` : `${item.category ? `${item.category} · ` : ''}verified ${item.verifiedAt ? timeAgo(item.verifiedAt) : ''}`}
      </Text>
    </Pressable>
  );
}

function NoteRow({ note, onProduct }: { note: OwnershipNote; onProduct: () => void }) {
  const details = [
    note.used_duration ? `Used ${note.used_duration}` : '',
    note.times_bought ? `${note.times_bought}x bought/used` : '',
    note.time_to_problem ? `Problem after ${note.time_to_problem}` : '',
    note.time_to_results ? `Results after ${note.time_to_results}` : '',
  ].filter(Boolean);
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 10 }}>
      <Pressable
        onPress={() => {
          hapticTap();
          onProduct();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <ProductImage uri={note.product_image} category={note.category ?? ''} size={42} radius={11} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>{note.product_name}</Text>
          <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.bone }}>{note.title}</Text>
        </View>
        <SealCheck size={17} color={colors.hi} weight="fill" />
      </Pressable>
      <Text numberOfLines={4} style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>{note.body}</Text>
      {details.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {details.map((d) => (
            <View key={d} style={{ backgroundColor: colors.hiSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.hiInk }}>{d}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {note.rating ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.bone3 }}>{note.rating}/5</Text> : null}
        {note.would_rebuy != null ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: note.would_rebuy ? colors.sageInk : colors.honeyInk }}>
            {note.would_rebuy ? 'Would buy again' : 'Would not buy again'}
          </Text>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{timeAgo(note.created_at)}</Text>
      </View>
    </View>
  );
}

function AnswerRow({ reply, onPress }: { reply: MemberReply; onPress: () => void }) {
  const th = reply.community_threads;
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ backgroundColor: colors.lac, borderRadius: 18, padding: 14, gap: 8, opacity: pressed ? 0.85 : 1 })}
    >
      {th ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProductImage uri={th.product_image} category="" size={28} radius={8} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>
            On “{th.title}”
          </Text>
          <CaretRight size={12} color={colors.bone3} weight="bold" />
        </View>
      ) : null}
      <Text numberOfLines={4} style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}>{reply.body}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {reply.owner_product_id ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.hiSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
            <SealCheck size={11} color={colors.hi} weight="fill" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.hiInk }}>Verified owner</Text>
          </View>
        ) : null}
        {reply.helpful ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ThumbsUp size={12} color={colors.bone3} weight="bold" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{reply.helpful} helpful</Text>
          </View>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{timeAgo(reply.created_at)}</Text>
      </View>
    </Pressable>
  );
}

function PostRow({ thread, onPress }: { thread: MemberThread; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, backgroundColor: colors.lac, borderRadius: 18, padding: 14, opacity: pressed ? 0.85 : 1 })}
    >
      <ProductImage uri={thread.product_image} category="" size={44} radius={12} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>
          {KIND_LABEL[thread.kind as ThreadKind] ?? 'Post'} · {thread.product_name}
          {thread.compare_name ? ` vs ${thread.compare_name}` : ''}
        </Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.bone }}>{thread.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ChatCircle size={12} color={colors.bone3} weight="bold" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{thread.reply_count}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{timeAgo(thread.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2, paddingVertical: 8 }}>{text}</Text>;
}
