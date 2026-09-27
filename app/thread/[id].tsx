import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnswerCard, Avatar, AvatarStack, useMemberGate } from '@/components/community';
import { ArrowLeft, CaretRight, PaperPlaneRight, SealCheck, ShareNetwork, ThumbsUp, UsersThree } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage, Shimmer } from '@/components/kit';
import { openLink } from '@/components/product/Panes';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { askOwners, fetchThread, KIND_LABEL, markHelpful, postReply, timeAgo } from '@/lib/community';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { CommunityReply, CommunityThread } from '@/lib/types';

export default function ThreadScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeId(params.id);
  const profile = useAppStore((s) => s.profile);
  const { requireMember, gate } = useMemberGate();
  const [body, setBody] = useState('');
  const [owner, setOwner] = useState(false);
  const [helped, setHelped] = useState<Record<string, boolean>>({});

  const thread = useQuery({
    queryKey: ['thread', id],
    queryFn: () => fetchThread(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
  const t = thread.data ?? null;
  const replies = t?.community_replies ?? [];

  const owners = useMutation({
    mutationFn: () => askOwners(t!.product_id, t!.title, t!.compare_id ?? undefined),
    onSuccess: () => hapticSuccess(),
  });

  const reply = useMutation({
    mutationFn: () => postReply(id, body.trim(), owner),
    onSuccess: (r) => {
      hapticSuccess();
      setBody('');
      qc.setQueryData<CommunityThread | null>(['thread', id], (prev) =>
        prev ? { ...prev, reply_count: prev.reply_count + 1, community_replies: [...(prev.community_replies ?? []), r] } : prev,
      );
      if (t) void qc.invalidateQueries({ queryKey: ['threads', t.product_id] });
    },
  });

  const helpful = (r: CommunityReply) => {
    if (helped[r.id]) return;
    hapticSelect();
    setHelped((h) => ({ ...h, [r.id]: true }));
    void markHelpful(r.id);
  };

  const openProduct = (pid: string, name: string) =>
    router.push({ pathname: '/product/[id]', params: { id: pid, q: name } } as Href);

  const canSend = body.trim().length >= 2 && !reply.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </IconButton>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>
          {t ? KIND_LABEL[t.kind] : 'Conversation'}
        </Text>
        <IconButton
          label="Share"
          onPress={() => t && void Share.share({ message: `“${t.title}” — owners are answering on Sourced` })}
        >
          <ShareNetwork size={18} color={colors.bone} weight="bold" />
        </IconButton>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {thread.isLoading ? (
            <View style={{ gap: 12, paddingTop: 8 }}>
              <Shimmer height={56} radius={16} />
              <Shimmer height={120} radius={20} />
              <Shimmer height={80} radius={18} />
            </View>
          ) : !t ? (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 60 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>This conversation isn’t available</Text>
              <PrimaryButton label="Try again" onPress={() => void thread.refetch()} />
            </View>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <ProductChip name={t.product_name} image={t.product_image} category={t.category} onPress={() => openProduct(t.product_id, t.product_name)} />
                {t.compare_id && t.compare_name ? (
                  <>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.bone3, paddingLeft: 14 }}>VS</Text>
                    <ProductChip name={t.compare_name} image={t.compare_image} category={t.category} onPress={() => openProduct(t.compare_id!, t.compare_name!)} />
                  </>
                ) : null}
              </View>

              <View style={{ backgroundColor: colors.lac, borderRadius: 22, padding: 18, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={t.author_name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{t.author_name}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                      {t.kind === 'worry' ? 'shared a worry' : t.kind === 'experience' ? 'shared their experience' : t.kind === 'compare' ? 'is comparing' : 'asked'} · {timeAgo(t.created_at)}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.bone }}>{t.title}</Text>
                {t.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.bone2 }}>{t.body}</Text> : null}
              </View>

              {owners.isIdle ? (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    owners.mutate();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: colors.hiSoft,
                    borderRadius: 18,
                    padding: 14,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
                    <UsersThree size={18} color={colors.white} weight="bold" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hiInk }}>See what owners already said</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.hiInk, opacity: 0.8 }}>
                      Answered only from real reviews and replies
                    </Text>
                  </View>
                  <CaretRight size={16} color={colors.hi} weight="bold" />
                </Pressable>
              ) : (
                <AnswerCard
                  question={t.title}
                  loading={owners.isPending}
                  error={owners.isError}
                  answer={owners.data ?? null}
                  onRetry={() => owners.mutate()}
                  onOpen={(url) => void openLink(url)}
                />
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone }}>
                  {replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}
                </Text>
                {replies.length ? <AvatarStack people={replies.map((r) => ({ name: r.author_name }))} size={22} max={5} ring={colors.wine} /> : null}
              </View>

              {replies.length ? (
                replies.map((r) => <ReplyCard key={r.id} reply={r} helped={Boolean(helped[r.id])} onHelpful={() => helpful(r)} />)
              ) : (
                <View style={{ backgroundColor: colors.lac, borderRadius: 18, padding: 16, gap: 6 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Own or used it? You’re who they need.</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
                    One honest sentence about how it went for you helps the next person decide.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {t ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.lac }}>
            <Pressable
              onPress={() => {
                hapticSelect();
                setOwner((o) => !o);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: owner }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  borderWidth: owner ? 0 : 1.5,
                  borderColor: colors.bone3,
                  backgroundColor: owner ? colors.hi : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {owner ? <SealCheck size={12} color={colors.white} weight="fill" /> : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: owner ? colors.hiInk : colors.bone2 }}>I own or have used this</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              {profile ? <Avatar name={profile.displayName} size={32} /> : null}
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={owner ? 'How has it been for you?' : 'Add to the conversation…'}
                placeholderTextColor={colors.bone3}
                multiline
                maxLength={2000}
                style={
                  {
                    flex: 1,
                    minHeight: 42,
                    maxHeight: 120,
                    backgroundColor: colors.lac2,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingTop: 11,
                    paddingBottom: 11,
                    fontFamily: fonts.regular,
                    fontSize: 15,
                    color: colors.bone,
                    outlineStyle: 'none',
                  } as never
                }
              />
              <Pressable
                disabled={!canSend}
                onPress={() => requireMember(() => reply.mutate())}
                accessibilityLabel="Send reply"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: canSend ? colors.hi : colors.wineDeep,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {reply.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <PaperPlaneRight size={17} color={colors.white} weight="fill" />}
              </Pressable>
            </View>
            {reply.isError ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.coral }}>Your reply didn’t send. Try again.</Text>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {gate}
    </SafeAreaView>
  );
}

function ProductChip({ name, image, category, onPress }: { name: string; image: string | null; category: string | null; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.lac,
        borderRadius: 16,
        padding: 10,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <ProductImage uri={image} category={category ?? ''} size={40} radius={10} />
      <View style={{ flex: 1, gap: 1 }}>
        <Eyebrow>About</Eyebrow>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>{name}</Text>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>What owners say</Text>
      <CaretRight size={14} color={colors.hi} weight="bold" />
    </Pressable>
  );
}

function ReplyCard({ reply, helped, onHelpful }: { reply: CommunityReply; helped: boolean; onHelpful: () => void }) {
  const count = reply.helpful + (helped ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Avatar name={reply.author_name} size={34} />
      <View style={{ flex: 1, backgroundColor: colors.lac, borderRadius: 18, borderTopLeftRadius: 6, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{reply.author_name}</Text>
          {reply.is_owner ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.hiSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
              <SealCheck size={11} color={colors.hi} weight="fill" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.hiInk }}>Owns it</Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>· {timeAgo(reply.created_at)}</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}>{reply.body}</Text>
        <Pressable onPress={onHelpful} disabled={helped} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
          <ThumbsUp size={14} color={helped ? colors.hi : colors.bone3} weight={helped ? 'fill' : 'bold'} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: helped ? colors.hi : colors.bone3 }}>
            {count ? `Helpful · ${count}` : 'Helpful'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function IconButton({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.lac,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
