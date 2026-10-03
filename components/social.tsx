import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, PlatformTag, StanceTag, compact } from '@/components/community';
import {
  ArrowFatUp,
  ArrowSquareOut,
  ArrowsLeftRight,
  Bell,
  BellRinging,
  ChatCircleDots,
  ChatTeardropText,
  Heart,
  Scan,
  Lightbulb,
  MagnifyingGlass,
  NotePencil,
  Question,
  Quotes,
  ShareNetwork,
  SmileyNervous,
  Star,
  X,
} from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { fetchNotifications, followThread, KIND_LABEL, postThread, timeAgo, voteThread } from '@/lib/community';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { extractProductFromPhoto, prepareImage, visionErrorCopy, type VisionAsset } from '@/lib/productVision';
import { displayName, rememberProduct, searchProducts, slugify } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { CommunityThread, Product, ThreadKind, WebVoice } from '@/lib/types';

export const KIND_STYLE: Record<ThreadKind, { Icon: typeof Question; fg: string; bg: string; verb: string }> = {
  question: { Icon: Question, fg: colors.hiInk, bg: colors.hiSoft, verb: 'asked' },
  review: { Icon: Star, fg: colors.sageInk, bg: colors.sageSoft, verb: 'reviewed' },
  experience: { Icon: ChatTeardropText, fg: colors.hiInk, bg: colors.hiSoft, verb: 'shared an experience' },
  worry: { Icon: SmileyNervous, fg: colors.honeyInk, bg: colors.honeySoft, verb: 'is worried' },
  tip: { Icon: Lightbulb, fg: colors.sageInk, bg: colors.sageSoft, verb: 'shared a tip' },
  compare: { Icon: ArrowsLeftRight, fg: colors.hiInk, bg: colors.hiSoft, verb: 'is comparing' },
};

export function KindBadge({ kind }: { kind: ThreadKind }) {
  const s = KIND_STYLE[kind] ?? KIND_STYLE.question;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: s.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <s.Icon size={11} color={s.fg} weight="bold" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: s.fg }}>{KIND_LABEL[kind]}</Text>
    </View>
  );
}

export function RatingStars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 8 : 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => {
            hapticSelect();
            onChange?.(n);
          }}
          hitSlop={4}
          accessibilityLabel={onChange ? `${n} star${n === 1 ? '' : 's'}` : undefined}
        >
          <Star size={size} color={n <= value ? '#F5A623' : colors.line} weight="fill" />
        </Pressable>
      ))}
    </View>
  );
}

function requestWebNotifications() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
}

/** Vote + bell state with optimistic updates, shared by feed cards and the thread screen. */
export function useThreadActions(thread: CommunityThread, requireMember: (then: () => void) => void) {
  const qc = useQueryClient();
  const [voted, setVoted] = useState(Boolean(thread.voted));
  const [votes, setVotes] = useState(thread.votes ?? 0);
  const [following, setFollowing] = useState(Boolean(thread.following));
  const [followers, setFollowers] = useState(thread.follower_count ?? 0);

  useEffect(() => {
    setVoted(Boolean(thread.voted));
    setVotes(thread.votes ?? 0);
    setFollowing(Boolean(thread.following));
    setFollowers(thread.follower_count ?? 0);
  }, [thread.id, thread.voted, thread.votes, thread.following, thread.follower_count]);

  const vote = () =>
    requireMember(() => {
      const on = !voted;
      hapticSelect();
      setVoted(on);
      setVotes((v) => Math.max(0, v + (on ? 1 : -1)));
      voteThread(thread.id, on)
        .then(setVotes)
        .catch(() => {
          setVoted(!on);
          setVotes((v) => Math.max(0, v + (on ? -1 : 1)));
        });
    });

  const toggleFollow = () =>
    requireMember(() => {
      const on = !following;
      if (on) {
        hapticSuccess();
        requestWebNotifications();
      } else hapticSelect();
      setFollowing(on);
      setFollowers((f) => Math.max(0, f + (on ? 1 : -1)));
      followThread(thread.id, on)
        .then((n) => {
          setFollowers(n);
          void qc.invalidateQueries({ queryKey: ['following'] });
        })
        .catch(() => setFollowing(!on));
    });

  return { voted, votes, following, followers, vote, toggleFollow };
}

export function PostCard({
  thread,
  requireMember,
  onOpen,
  onProduct,
  onImage,
}: {
  thread: CommunityThread;
  requireMember: (then: () => void) => void;
  onOpen: () => void;
  onProduct: (id: string, name: string) => void;
  onImage?: (url: string) => void;
}) {
  const a = useThreadActions(thread, requireMember);
  const s = KIND_STYLE[thread.kind] ?? KIND_STYLE.question;
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onOpen();
      }}
      style={({ pressed }) => ({ backgroundColor: colors.lac, borderRadius: 22, padding: 16, gap: 12, opacity: pressed ? 0.94 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={thread.author_name} size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>
            {thread.author_name} <Text style={{ fontFamily: fonts.regular, color: colors.bone3 }}>{s.verb}</Text>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <KindBadge kind={thread.kind} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{timeAgo(thread.created_at)}</Text>
          </View>
        </View>
        <Pressable
          onPress={a.toggleFollow}
          hitSlop={8}
          accessibilityLabel={a.following ? 'Turn off updates' : 'Get updates on this discussion'}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: a.following ? colors.hiSoft : colors.lac2 }}
        >
          {a.following ? <BellRinging size={17} color={colors.hi} weight="fill" /> : <Bell size={17} color={colors.bone2} weight="bold" />}
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          hapticTap();
          onProduct(thread.product_id, thread.product_name);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.lac2, borderRadius: 12, padding: 6, paddingRight: 10, opacity: pressed ? 0.7 : 1 })}
      >
        <ProductImage uri={thread.product_image} category={thread.category ?? ''} size={26} radius={7} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.bone }}>
          {thread.product_name}
          {thread.compare_name ? <Text style={{ color: colors.bone3 }}>{`  vs  `}</Text> : null}
          {thread.compare_name ?? ''}
        </Text>
      </Pressable>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17.5, lineHeight: 23, letterSpacing: -0.3, color: colors.bone }}>{thread.title}</Text>
        {thread.body ? (
          <Text numberOfLines={4} style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone2 }}>
            {thread.body}
          </Text>
        ) : null}
      </View>

      {thread.image_url ? (
        <Pressable onPress={() => onImage?.(thread.image_url!)} accessibilityLabel="View photo">
          <Image source={{ uri: thread.image_url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.lac2 }} resizeMode="cover" />
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <ActionPill active={a.voted} onPress={a.vote} label={a.votes ? compact(a.votes) : 'Useful'} accessibilityLabel="Upvote">
          <ArrowFatUp size={16} color={a.voted ? colors.white : colors.bone2} weight={a.voted ? 'fill' : 'bold'} />
        </ActionPill>
        <ActionPill onPress={onOpen} label={thread.reply_count ? `${thread.reply_count}` : 'Reply'} accessibilityLabel="Replies">
          <ChatCircleDots size={16} color={colors.bone2} weight="bold" />
        </ActionPill>
        <View style={{ flex: 1 }} />
        {a.followers > 1 ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{a.followers} following</Text> : null}
        <Pressable
          onPress={() => void Share.share({ message: `“${thread.title}” — about ${thread.product_name}, on Unmask` })}
          hitSlop={8}
          accessibilityLabel="Share"
          style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
        >
          <ShareNetwork size={17} color={colors.bone2} weight="bold" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ActionPill({ children, label, onPress, active, accessibilityLabel }: { children: ReactNode; label: string; onPress: () => void; active?: boolean; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? colors.hi : colors.lac2,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? colors.white : colors.bone2 }}>{label}</Text>
    </Pressable>
  );
}

/** A real owner's words pulled from the web, shown in the feed with where it came from. */
export function WebVoicePost({ voice, onProduct, onOpen, onDiscuss }: { voice: WebVoice; onProduct: () => void; onOpen: (url: string) => void; onDiscuss: () => void }) {
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 22, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={voice.author} uri={voice.avatar} size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>{voice.author}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PlatformTag platform={voice.platform} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>· owner voice from the web</Text>
          </View>
        </View>
        <StanceTag stance={voice.stance} />
      </View>
      <Pressable
        onPress={onProduct}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.lac2, borderRadius: 12, padding: 6, paddingRight: 10, opacity: pressed ? 0.7 : 1 })}
      >
        <ProductImage uri={voice.product_image} category={voice.category} size={26} radius={7} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.bone }}>{voice.product_name}</Text>
        {voice.score ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.hi }}>{voice.score}</Text> : null}
      </Pressable>
      <Text numberOfLines={6} style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.bone }}>
        “{voice.text}”
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {voice.likes > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.coralSoft }}>
            <Heart size={14} color={colors.coral} weight="fill" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.coral }}>{compact(voice.likes)} agree</Text>
          </View>
        ) : null}
        <ActionPill onPress={onDiscuss} label="Discuss" accessibilityLabel="Start a discussion about this">
          <ChatCircleDots size={16} color={colors.bone2} weight="bold" />
        </ActionPill>
        <View style={{ flex: 1 }} />
        {voice.url ? (
          <Pressable onPress={() => onOpen(voice.url)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.hi }}>Original</Text>
            <ArrowSquareOut size={13} color={colors.hi} weight="bold" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Notifications bell

export function useNotifications() {
  const profile = useAppStore((s) => s.profile);
  const q = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: fetchNotifications,
    enabled: Boolean(profile),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const prev = useRef(0);
  const unread = q.data?.unread ?? 0;
  useEffect(() => {
    if (unread > prev.current && prev.current >= 0 && Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      const latest = q.data?.notifications.find((n) => !n.read);
      if (latest && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        new Notification(`${latest.actor_name} replied`, { body: `${latest.thread_title ?? ''}\n${latest.snippet ?? ''}`.trim() });
      }
    }
    prev.current = unread;
  }, [unread, q.data]);
  return q;
}

export function BellButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const router = useRouter();
  const n = useNotifications();
  const unread = n.data?.unread ?? 0;
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        router.push('/notifications' as Href);
      }}
      accessibilityLabel={unread ? `${unread} new updates` : 'Updates'}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: tone === 'dark' ? 'rgba(255,255,255,0.12)' : colors.lac,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Bell size={20} color={tone === 'dark' ? colors.white : colors.bone} weight={unread ? 'fill' : 'bold'} />
      {unread ? (
        <View style={{ position: 'absolute', top: 5, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.wine }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.white }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Composer

const COMPOSER_KINDS: Array<{ kind: ThreadKind; label: string; hint: string; title: string; detailsPlaceholder: string; starters: string[] }> = [
  {
    kind: 'experience',
    label: 'Experience',
    hint: 'You used or own it — say how it really is',
    title: 'Sum it up in one line',
    detailsPlaceholder: 'How long you’ve had it, what surprised you, what you’d tell a friend…',
    starters: ['I’ve had it for ', 'What surprised me: ', 'The one thing I’d change: ', 'I’d tell a friend '],
  },
  {
    kind: 'question',
    label: 'Question',
    hint: 'Owners reply from experience',
    title: 'What do you want to know?',
    detailsPlaceholder: 'Your situation, budget, or what you’ve already read — helps owners reply…',
    starters: ['I’m planning to use it for ', 'Does anyone know if ', 'My budget is '],
  },
  {
    kind: 'compare',
    label: 'Comparison',
    hint: 'Torn between two products?',
    title: 'What are you deciding between?',
    detailsPlaceholder: 'How you’ll use them, what matters most, why you’re torn…',
    starters: ['I’ll mostly use it for ', 'What matters most to me is ', 'Price-wise '],
  },
];


type PickedProduct = Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'heroImageUrl'>;

export function Composer({
  visible,
  onClose,
  onPosted,
  initialProduct,
  initialKind,
  initialBody,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: (thread: CommunityThread) => void;
  initialProduct?: PickedProduct | null;
  initialKind?: ThreadKind;
  initialBody?: string;
}) {
  const profile = useAppStore((s) => s.profile);
  const [kind, setKind] = useState<ThreadKind>(initialKind ?? 'experience');
  const [product, setProduct] = useState<PickedProduct | null>(initialProduct ?? null);
  const [compare, setCompare] = useState<PickedProduct | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(initialBody ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState<'product' | 'compare' | null>(initialProduct ? null : 'product');

  useEffect(() => {
    if (!visible) return;
    setKind(initialKind ?? 'experience');
    setProduct(initialProduct ?? null);
    setCompare(null);
    setTitle('');
    setBody(initialBody ?? '');
    setError('');
    setPicking(initialProduct ? null : 'product');
  }, [visible, initialProduct, initialKind, initialBody]);

  const meta = COMPOSER_KINDS.find((k) => k.kind === kind)!;
  const ready = Boolean(product) && title.trim().length >= 4 && (kind !== 'compare' || Boolean(compare)) && !busy;

  const submit = async () => {
    if (!ready || !product) return;
    setBusy(true);
    setError('');
    try {
      const thread = await postThread({
        product,
        kind,
        title: title.trim(),
        body: body.trim() || undefined,
        compare: kind === 'compare' ? compare : null,
        rating: null,
      });
      hapticSuccess();
      onPosted(thread);
    } catch {
      setError('That didn’t post. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 12 }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cancel">
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.bone2 }}>Cancel</Text>
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>New post</Text>
          <Pressable
            onPress={() => void submit()}
            disabled={!ready}
            style={{ height: 36, paddingHorizontal: 18, borderRadius: 18, backgroundColor: ready ? colors.hi : colors.wineDeep, alignItems: 'center', justifyContent: 'center' }}
          >
            {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ready ? colors.white : colors.bone3 }}>Post</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={profile?.displayName ?? 'You'} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{profile?.displayName ?? 'You'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>{meta.hint}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COMPOSER_KINDS.map((k) => {
              const on = k.kind === kind;
              const s = KIND_STYLE[k.kind];
              return (
                <Pressable
                  key={k.kind}
                  onPress={() => {
                    hapticSelect();
                    setKind(k.kind);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? colors.black : colors.lac, borderWidth: on ? 0 : 1, borderColor: colors.line }}
                >
                  <s.Icon size={14} color={on ? colors.white : s.fg} weight="bold" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.white : colors.bone }}>{k.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ProductSlot label="About" value={product} onChange={() => setPicking('product')} />
          {kind === 'compare' ? <ProductSlot label="Versus" value={compare} onChange={() => setPicking('compare')} /> : null}
          {picking ? (
            <ProductSearch
              onPick={(p) => {
                if (picking === 'compare') setCompare(p);
                else setProduct(p);
                setPicking(null);
              }}
              onCancel={product ? () => setPicking(null) : undefined}
            />
          ) : null}

          <WriteField
            headline
            Icon={Quotes}
            label="Headline"
            tag="Required"
            value={title}
            onChangeText={setTitle}
            placeholder={meta.title}
            maxLength={280}
          />
          <WriteField
            Icon={NotePencil}
            label="The details"
            tag="Optional"
            value={body}
            onChangeText={setBody}
            placeholder={meta.detailsPlaceholder}
            maxLength={2000}
            starters={meta.starters}
          />

          {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.coral }}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function WriteField({
  Icon,
  label,
  tag,
  value,
  onChangeText,
  placeholder,
  maxLength,
  headline,
  starters,
}: {
  Icon: typeof Quotes;
  label: string;
  tag: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength: number;
  headline?: boolean;
  starters?: string[];
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const near = value.length > maxLength * 0.85;
  const active = focused || Boolean(value);
  return (
    <Pressable
      onPress={() => input.current?.focus()}
      style={{
        backgroundColor: colors.lac,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 14,
        gap: 8,
        borderWidth: 1.5,
        borderColor: focused ? colors.hi : 'transparent',
        boxShadow: focused ? `0 0 0 4px ${colors.hiSoft}` : undefined,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: active ? colors.hi : colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={active ? colors.white : colors.hi} weight="bold" />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.2, color: focused ? colors.hi : colors.bone2 }}>{label}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: near ? colors.coral : colors.bone3 }}>
          {active ? `${value.length}/${maxLength}` : tag}
        </Text>
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.bone3}
        maxLength={maxLength}
        multiline
        style={
          (headline
            ? { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: colors.bone, minHeight: 28, outlineStyle: 'none' }
            : { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.bone, minHeight: 104, textAlignVertical: 'top', outlineStyle: 'none' }) as never
        }
      />
      {starters?.length && !value.trim() ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {starters.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                hapticSelect();
                onChangeText(s);
                setTimeout(() => input.current?.focus(), 0);
              }}
              style={({ pressed }) => ({ height: 30, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center', backgroundColor: colors.hiSoft, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.hi }}>{s.trim()}…</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function ProductSlot({ label, value, onChange }: { label: string; value: PickedProduct | null; onChange: () => void }) {
  return (
    <Pressable
      onPress={onChange}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.lac, borderRadius: 16, padding: 10, opacity: pressed ? 0.8 : 1 })}
    >
      {value ? (
        <ProductImage uri={value.heroImageUrl} category={value.category} size={40} radius={10} />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
          <MagnifyingGlass size={18} color={colors.hi} weight="bold" />
        </View>
      )}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: value ? colors.bone : colors.bone3 }}>
          {value ? displayName(value) : 'Choose a product'}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.hi }}>{value ? 'Change' : 'Pick'}</Text>
    </Pressable>
  );
}

function ProductSearch({ onPick, onCancel }: { onPick: (p: PickedProduct) => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(draft.trim()), 450);
    return () => clearTimeout(t);
  }, [draft]);
  const res = useQuery({ queryKey: ['search', q], queryFn: () => searchProducts(q), enabled: q.length > 1, staleTime: 10 * 60_000 });
  const list = res.data?.products.slice(0, 6) ?? [];

  const identifyPhoto = async () => {
    setScanError('');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65, base64: true, allowsEditing: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setScanning(true);
    try {
      const prepared = await prepareImage({ uri: a.uri, width: a.width, height: a.height, base64: a.base64, mimeType: a.mimeType });
      if (!prepared) {
        setScanError('Could not read that photo.');
        return;
      }
      const asset: VisionAsset = { uri: a.uri, width: a.width, height: a.height, base64: prepared.base64, mimeType: prepared.mime };
      const vision = await extractProductFromPhoto(asset);
      if (!vision.ok || !vision.label) {
        setScanError(visionErrorCopy(vision).body);
        return;
      }
      const label = vision.searchQuery || vision.label;
      const id = slugify(label);
      const hero = vision.imageUrl || vision.matches?.find((m) => m.exact && m.image)?.image || null;
      rememberProduct({ id, name: vision.name || label, brand: vision.brand ?? '', category: vision.category || 'Product', heroImageUrl: hero });
      hapticSuccess();
      onPick({ id, name: vision.name || label, brand: vision.brand ?? '', category: vision.category || 'Product', heroImageUrl: hero });
    } catch {
      setScanError('Photo identification failed. Try search instead.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 16, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.lac2, borderRadius: 12, paddingHorizontal: 12, height: 44 }}>
        <MagnifyingGlass size={16} color={colors.bone3} weight="bold" />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoFocus
          placeholder="Search the product"
          placeholderTextColor={colors.bone3}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15.5, color: colors.bone, outlineStyle: 'none' } as never}
        />
        <Pressable
          onPress={() => void identifyPhoto()}
          disabled={scanning}
          accessibilityLabel="Identify product from photo"
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center', opacity: scanning ? 0.6 : 1 }}
        >
          {scanning ? <ActivityIndicator color={colors.white} size="small" /> : <Scan size={17} color={colors.white} weight="bold" />}
        </Pressable>
        {onCancel ? (
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>Done</Text>
          </Pressable>
        ) : null}
      </View>
      {scanError ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{scanError}</Text> : null}
      {res.isFetching ? <ActivityIndicator color={colors.hi} /> : null}
      {list.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => {
            hapticTap();
            onPick({ id: p.id, name: p.name, brand: p.brand, category: p.category, heroImageUrl: p.heroImageUrl });
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
        >
          <ProductImage uri={p.heroImageUrl} category={p.category} size={40} radius={10} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>{displayName(p)}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{p.category}</Text>
          </View>
        </Pressable>
      ))}
      {q.length > 1 && !res.isFetching && !list.length ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2 }}>No match yet — try the brand and model.</Text>
      ) : null}
    </View>
  );
}
