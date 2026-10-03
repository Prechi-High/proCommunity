import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnswerCard, Avatar, AvatarStack, useMemberGate } from '@/components/community';
import { ArrowFatUp, ArrowLeft, Bell, BellRinging, CaretRight, PaperPlaneRight, SealCheck, ShareNetwork, ThumbsUp, UsersThree } from '@/components/icons';
import { Lightbox } from '@/components/Lightbox';
import { KIND_STYLE, RatingStars, useThreadActions } from '@/components/social';
import { Eyebrow, PrimaryButton, ProductImage, Shimmer } from '@/components/kit';
import { openLink } from '@/components/product/Panes';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { askOwners, fetchThread, KIND_LABEL, markHelpful, postReply, timeAgo } from '@/lib/community';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { useOwnsProduct } from '@/lib/owners';
import { useAppStore } from '@/lib/store';
import type { CommunityReply, CommunityThread } from '@/lib/types';
import { useVerifyOwner } from '@/components/VerifyOwner';

export default function ThreadScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeId(params.id);
  const profile = useAppStore((s) => s.profile);
  const { requireMember, gate } = useMemberGate();
  const [body, setBody] = useState('');
  const [helped, setHelped] = useState<Record<string, boolean>>({});
  const [photo, setPhoto] = useState<string | null>(null);

  const thread = useQuery({
    queryKey: ['thread', id],
    queryFn: () => fetchThread(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
  const t = thread.data ?? null;
  const replies = t?.community_replies ?? [];
  const ownsMain = useOwnsProduct(t?.product_id);
  const ownsCompare = useOwnsProduct(t?.compare_id);
  const owned = ownsMain ?? ownsCompare;
  const verify = useVerifyOwner();

  const owners = useMutation({
    mutationFn: () => askOwners(t!.product_id, t!.title, t!.compare_id ?? undefined),
    onSuccess: () => hapticSuccess(),
  });

  const reply = useMutation({
    mutationFn: () => postReply(id, body.trim()),
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
  const openMember = (memberId: string) => router.push({ pathname: '/member/[id]', params: { id: memberId } } as unknown as Href);

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
          onPress={() => t && void Share.share({ message: `“${t.title}” — owners are answering on Unmask` })}
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
                <Pressable onPress={() => openMember(t.author_id)} accessibilityLabel={`View ${t.author_name}’s profile`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={t.author_name} size={38} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{t.author_name}</Text>
                      {t.owner_product_id ? <VerifiedOwnerPill /> : null}
                    </View>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                      {KIND_STYLE[t.kind]?.verb ?? 'posted'} · {timeAgo(t.created_at)}
                    </Text>
                  </View>
                </Pressable>
                {t.owner_product_id && t.owner_product_name ? (
                  <OwnedChip name={t.owner_product_name} image={t.owner_product_image ?? null} onPress={() => openProduct(t.owner_product_id!, t.owner_product_name!)} />
                ) : null}
                {t.kind === 'review' && t.rating ? <RatingStars value={t.rating} size={18} /> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.bone }}>{t.title}</Text>
                {t.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.bone2 }}>{t.body}</Text> : null}
                {t.image_url ? (
                  <Pressable onPress={() => setPhoto(t.image_url ?? null)} accessibilityLabel="View photo">
                    <Image source={{ uri: t.image_url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.lac2 }} resizeMode="cover" />
                  </Pressable>
                ) : null}
                <ThreadActions thread={t} requireMember={requireMember} />
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
                replies.map((r) => (
                  <ReplyCard
                    key={r.id}
                    reply={r}
                    helped={Boolean(helped[r.id])}
                    onHelpful={() => helpful(r)}
                    onAuthor={() => openMember(r.author_id)}
                    onProduct={(pid, name) => openProduct(pid, name)}
                  />
                ))
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
            {owned ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                <SealCheck size={15} color={colors.hi} weight="fill" />
                <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.hiInk }}>
                  Answering as a verified owner of the {owned.productName}
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  hapticSelect();
                  verify.start({ id: t.product_id, name: t.product_name, brand: t.brand ?? '', category: t.category ?? '', heroImageUrl: t.product_image });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
                accessibilityRole="button"
              >
                <SealCheck size={15} color={colors.bone2} weight="bold" />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>
                  Own it? <Text style={{ color: colors.hi, fontFamily: fonts.semibold }}>Verify with a photo</Text> to answer as an owner
                </Text>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              {profile ? <Avatar name={profile.displayName} size={32} /> : null}
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={owned ? 'How has it been for you?' : 'Add to the conversation…'}
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
      <Lightbox images={photo ? [{ url: photo }] : []} index={photo ? 0 : null} onClose={() => setPhoto(null)} />
      {gate}
      {verify.sheet}
    </SafeAreaView>
  );
}

function VerifiedOwnerPill() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.hiSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
      <SealCheck size={11} color={colors.hi} weight="fill" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.hiInk }}>Verified owner</Text>
    </View>
  );
}

/** The product this person proved they own — tap to open it. */
function OwnedChip({ name, image, onPress }: { name: string; image: string | null; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityLabel={`Owns ${name}. Open product`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        backgroundColor: colors.lac2,
        borderRadius: 12,
        paddingVertical: 5,
        paddingLeft: 5,
        paddingRight: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <ProductImage uri={image} category="" size={26} radius={7} />
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone2 }}>
        Owns the <Text style={{ fontFamily: fonts.semibold, color: colors.bone }}>{name}</Text>
      </Text>
      <CaretRight size={11} color={colors.bone3} weight="bold" />
    </Pressable>
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

function ReplyCard({
  reply,
  helped,
  onHelpful,
  onAuthor,
  onProduct,
}: {
  reply: CommunityReply;
  helped: boolean;
  onHelpful: () => void;
  onAuthor: () => void;
  onProduct: (id: string, name: string) => void;
}) {
  const count = reply.helpful + (helped ? 1 : 0);
  const verified = Boolean(reply.owner_product_id && reply.owner_product_name);
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pressable onPress={onAuthor} accessibilityLabel={`View ${reply.author_name}’s profile`}>
        <Avatar name={reply.author_name} size={34} />
      </Pressable>
      <View style={{ flex: 1, backgroundColor: colors.lac, borderRadius: 18, borderTopLeftRadius: 6, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pressable onPress={onAuthor} hitSlop={6}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{reply.author_name}</Text>
          </Pressable>
          {verified ? <VerifiedOwnerPill /> : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>· {timeAgo(reply.created_at)}</Text>
        </View>
        {verified ? (
          <OwnedChip name={reply.owner_product_name!} image={reply.owner_product_image ?? null} onPress={() => onProduct(reply.owner_product_id!, reply.owner_product_name!)} />
        ) : null}
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

function ThreadActions({ thread, requireMember }: { thread: CommunityThread; requireMember: (then: () => void) => void }) {
  const a = useThreadActions(thread, requireMember);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
      <Pressable
        onPress={a.vote}
        accessibilityLabel="Upvote"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: a.voted ? colors.hi : colors.lac2 }}
      >
        <ArrowFatUp size={17} color={a.voted ? colors.white : colors.bone2} weight={a.voted ? 'fill' : 'bold'} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: a.voted ? colors.white : colors.bone2 }}>{a.votes || 'Useful'}</Text>
      </Pressable>
      <Pressable
        onPress={a.toggleFollow}
        accessibilityLabel={a.following ? 'Turn off updates' : 'Get updates'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: a.following ? colors.hiSoft : colors.lac2 }}
      >
        {a.following ? <BellRinging size={17} color={colors.hi} weight="fill" /> : <Bell size={17} color={colors.bone2} weight="bold" />}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: a.following ? colors.hiInk : colors.bone2 }}>
          {a.following ? 'Following' : 'Get updates'}
        </Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {a.followers ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>{a.followers} following</Text> : null}
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
