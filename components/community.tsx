import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  ArrowSquareOut,
  ArrowsLeftRight,
  ChatTeardropText,
  ChatsCircle,
  Globe,
  Heart,
  PaperPlaneRight,
  Question,
  RedditLogo,
  SealCheck,
  SmileyNervous,
  Sparkle,
  UsersThree,
  X,
  YoutubeLogo,
} from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { colors, elevation, fonts } from '@/constants/theme';
import { askOwners, KIND_LABEL, timeAgo } from '@/lib/community';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { AskAnswer, AskCite, CommunityThread, ProductProfile, Stance, TrendingProduct, Voice } from '@/lib/types';

// ---------------------------------------------------------------------------
// Marker — phrases get highlighted word by word, like a pen revealing what matters.

type Seg = { text: string; marked: boolean };

function splitMarks(text: string, marks: string[]): Seg[] {
  const clean = marks.map((m) => m.trim()).filter((m) => m.length > 1);
  if (!clean.length) return [{ text, marked: false }];
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const m of clean) {
    const i = lower.indexOf(m.toLowerCase());
    if (i >= 0 && !ranges.some(([a, b]) => i < b && i + m.length > a)) ranges.push([i, i + m.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: Seg[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) out.push({ text: text.slice(at, a), marked: false });
    out.push({ text: text.slice(a, b), marked: true });
    at = b;
  }
  if (at < text.length) out.push({ text: text.slice(at), marked: false });
  return out;
}

export function Marker({
  text,
  marks,
  dark,
  delay = 0,
  style,
  speed = 55,
}: {
  text: string;
  marks: (string | null | undefined)[];
  dark?: boolean;
  delay?: number;
  style?: StyleProp<TextStyle>;
  speed?: number;
}) {
  const segs = useMemo(() => splitMarks(text, marks.filter(Boolean) as string[]), [text, marks]);
  const tokens = useMemo(() => segs.map((s) => (s.marked ? s.text.split(/(\s+)/).filter(Boolean) : [s.text])), [segs]);
  const total = useMemo(() => segs.reduce((n, s, i) => n + (s.marked ? tokens[i].length : 0), 0), [segs, tokens]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (!total) return;
    let n = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        n += 1;
        setShown(n);
        if (n >= total && interval) clearInterval(interval);
      }, speed);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [total, delay, speed, text]);

  let k = 0;
  const bg = dark ? colors.markDark : colors.mark;
  const fg = dark ? colors.white : colors.markInk;
  return (
    <Text style={style}>
      {segs.map((s, i) =>
        s.marked ? (
          tokens[i].map((w, j) => {
            const on = k++ < shown;
            return (
              <Text
                key={`${i}-${j}`}
                style={{
                  backgroundColor: on ? bg : 'transparent',
                  color: on ? fg : undefined,
                  fontFamily: fonts.semibold,
                }}
              >
                {w}
              </Text>
            );
          })
        ) : (
          <Text key={i}>{s.text}</Text>
        ),
      )}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// People

const AVATAR_TONES = ['#1A4DFF', '#0A0A0B', '#1F9D55', '#C27C0E', '#D93A3A', '#6B3FE0', '#0E8A9E'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const clean = name.replace(/^r\//, '').replace(/[^a-zA-Z0-9 ]+/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, uri, size = 36, ring }: { name: string; uri?: string | null; size?: number; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const tone = AVATAR_TONES[hash(name) % AVATAR_TONES.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      {uri && !failed ? (
        <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.38, color: colors.white }}>{initials(name)}</Text>
      )}
    </View>
  );
}

export function AvatarStack({
  people,
  size = 26,
  max = 5,
  ring = colors.lac,
}: {
  people: { name: string; avatar?: string | null }[];
  size?: number;
  max?: number;
  ring?: string;
}) {
  const list = people.slice(0, max);
  return (
    <View style={{ flexDirection: 'row' }}>
      {list.map((p, i) => (
        <View key={`${p.name}-${i}`} style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: max - i }}>
          <Avatar name={p.name} uri={p.avatar} size={size} ring={ring} />
        </View>
      ))}
    </View>
  );
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** "Built from 7.2k ratings, 8 owners and 6 discussions" — the human footprint behind a profile. */
export function peopleLine(profile: ProductProfile): string {
  const p = profile.people;
  const bits: string[] = [];
  const ratings = p?.ratings || profile.ratingCount || 0;
  if (ratings) bits.push(`${compact(ratings)} ratings`);
  if (p?.voices) bits.push(`${p.voices} owner ${p.voices === 1 ? 'voice' : 'voices'}`);
  if (p?.discussions) bits.push(`${p.discussions} discussions`);
  return bits.length ? `From ${bits.join(' · ')}` : `From ${profile.sources.length} public sources`;
}

// ---------------------------------------------------------------------------
// Voices

const PLATFORM: Record<string, { label: string; Icon: typeof Globe; color: string }> = {
  youtube: { label: 'YouTube', Icon: YoutubeLogo, color: '#E62117' },
  reddit: { label: 'Reddit', Icon: RedditLogo, color: '#FF4500' },
  review: { label: 'Review', Icon: Globe, color: colors.bone2 },
  forum: { label: 'Forum', Icon: ChatsCircle, color: colors.bone2 },
  sourced: { label: 'Sourced member', Icon: SealCheck, color: colors.hi },
};

export function PlatformTag({ platform }: { platform: string }) {
  const p = PLATFORM[platform] ?? PLATFORM.review;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <p.Icon size={12} color={p.color} weight="fill" />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{p.label}</Text>
    </View>
  );
}

const STANCE: Record<Stance, { label: string; bg: string; fg: string }> = {
  love: { label: 'Loves it', bg: colors.sageSoft, fg: colors.sageInk },
  mixed: { label: 'Mixed', bg: colors.lac2, fg: colors.bone2 },
  warn: { label: 'Warns', bg: colors.coralSoft, fg: colors.coral },
};

export function StanceTag({ stance }: { stance: Stance }) {
  const s = STANCE[stance];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: s.fg }}>{s.label}</Text>
    </View>
  );
}

export function VoiceCard({
  voice,
  onOpen,
  delay = 0,
  style,
}: {
  voice: Voice;
  onOpen?: (url: string) => void;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={() => voice.url && onOpen?.(voice.url)}
      style={({ pressed }) => [
        { backgroundColor: colors.lac, borderRadius: 18, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={voice.author} uri={voice.avatar} size={34} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>
            {voice.author}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PlatformTag platform={voice.platform} />
            {voice.where ? (
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                {voice.where}
              </Text>
            ) : null}
          </View>
        </View>
        <StanceTag stance={voice.stance} />
      </View>
      <Marker
        text={`“${voice.text}”`}
        marks={[voice.mark]}
        delay={delay}
        style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {voice.likes > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Heart size={12} color={colors.coral} weight="fill" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{compact(voice.likes)} agree</Text>
          </View>
        ) : null}
        {voice.topic ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>#{voice.topic.toLowerCase().replace(/\s+/g, '')}</Text> : null}
        <View style={{ flex: 1 }} />
        {voice.url ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.hi }}>See original</Text>
            <ArrowSquareOut size={12} color={colors.hi} weight="bold" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Threads

const KIND_ICON = { question: Question, worry: SmileyNervous, experience: ChatTeardropText, compare: ArrowsLeftRight } as const;

export function ThreadCard({
  thread,
  onPress,
  showProduct,
  style,
}: {
  thread: CommunityThread;
  onPress: () => void;
  showProduct?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const Icon = KIND_ICON[thread.kind] ?? Question;
  const repliers = (thread.community_replies ?? []).map((r) => ({ name: r.author_name }));
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [{ backgroundColor: colors.lac, borderRadius: 18, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 }, style]}
    >
      {showProduct ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProductImage uri={thread.product_image} category={thread.category ?? ''} size={26} radius={7} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone2 }}>
            {thread.product_name}
            {thread.compare_name ? `  vs  ${thread.compare_name}` : ''}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Avatar name={thread.author_name} size={30} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{thread.author_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon size={11} color={thread.kind === 'worry' ? colors.honey : colors.hi} weight="bold" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: thread.kind === 'worry' ? colors.honeyInk : colors.hiInk }}>
                {KIND_LABEL[thread.kind]}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>· {timeAgo(thread.created_at)}</Text>
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2, color: colors.bone }}>{thread.title}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 40 }}>
        {repliers.length ? <AvatarStack people={repliers} size={20} max={4} /> : null}
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: thread.reply_count ? colors.bone2 : colors.hi }}>
          {thread.reply_count
            ? `${thread.reply_count} ${thread.reply_count === 1 ? 'reply' : 'replies'}`
            : 'Be the first to answer'}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Ask the owners — answers only from what real people said.

export function AskOwners({
  productId,
  compareId,
  suggestions,
  onPostQuestion,
  onOpen,
  placeholder = 'Ask like you’d ask a friend who owns it…',
  autoFocus,
}: {
  productId: string;
  compareId?: string;
  suggestions: string[];
  onPostQuestion: (question: string) => void;
  onOpen?: (url: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const ask = useMutation({
    mutationFn: (question: string) => askOwners(productId, question, compareId),
    onSuccess: () => hapticSuccess(),
  });
  const submit = (text: string) => {
    const t = text.trim();
    if (t.length < 3 || ask.isPending) return;
    hapticTap();
    setAsked(t);
    setQ('');
    ask.mutate(t);
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={[{ backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 12 }, elevation.raised]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
            <UsersThree size={15} color={colors.hi} weight="bold" />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Ask the owners</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.bone3 }}>answers only from real people</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => submit(q)}
            placeholder={placeholder}
            placeholderTextColor={colors.bone3}
            autoFocus={autoFocus}
            multiline
            blurOnSubmit
            returnKeyType="send"
            style={
              {
                flex: 1,
                minHeight: 44,
                maxHeight: 110,
                backgroundColor: colors.lac2,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 12,
                fontFamily: fonts.regular,
                fontSize: 15,
                color: colors.bone,
                outlineStyle: 'none',
              } as never
            }
          />
          <Pressable
            onPress={() => submit(q)}
            disabled={q.trim().length < 3 || ask.isPending}
            accessibilityLabel="Ask"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: q.trim().length >= 3 ? colors.hi : colors.wineDeep,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {ask.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <PaperPlaneRight size={18} color={colors.white} weight="fill" />}
          </Pressable>
        </View>
        {!asked ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => submit(s)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {asked ? (
        <AnswerCard
          question={asked}
          loading={ask.isPending}
          error={ask.isError}
          answer={ask.data ?? null}
          onRetry={() => ask.mutate(asked)}
          onFollowup={submit}
          onPostQuestion={() => onPostQuestion(asked)}
          onOpen={onOpen}
        />
      ) : null}
    </View>
  );
}

export function AnswerCard({
  question,
  loading,
  error,
  answer,
  onRetry,
  onFollowup,
  onPostQuestion,
  onOpen,
}: {
  question: string;
  loading: boolean;
  error: boolean;
  answer: AskAnswer | null;
  onRetry: () => void;
  onFollowup?: (q: string) => void;
  onPostQuestion?: () => void;
  onOpen?: (url: string) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.hi, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.white }}>{question}</Text>
      </View>
      <View style={{ backgroundColor: colors.lac, borderRadius: 20, borderTopLeftRadius: 6, padding: 16, gap: 12 }}>
        {loading ? (
          <ReadingPeople />
        ) : error || !answer ? (
          <Pressable onPress={onRetry}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.bone2 }}>
              Couldn’t reach the owners just now. <Text style={{ color: colors.hi }}>Try again</Text>
            </Text>
          </Pressable>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {answer.cites.length ? (
                <AvatarStack people={answer.cites.map((c) => ({ name: c.author, avatar: c.avatar }))} size={22} max={4} />
              ) : null}
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>
                {answer.enough
                  ? `From ${answer.cites.length} ${answer.cites.length === 1 ? 'person' : 'people'} who used it`
                  : answer.cites.length
                    ? `No direct answer yet · closest from ${answer.cites.length} ${answer.cites.length === 1 ? 'person' : 'people'}`
                    : 'Nobody has covered this yet'}
              </Text>
            </View>
            <Marker
              text={answer.answer}
              marks={[answer.mark]}
              delay={250}
              style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.bone }}
            />
            {answer.cites.length ? (
              <View style={{ gap: 8 }}>
                {answer.cites.map((c) => (
                  <CiteRow key={c.id} cite={c} onOpen={onOpen} />
                ))}
              </View>
            ) : null}
            {answer.followups.length && onFollowup ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {answer.followups.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => onFollowup(f)}
                    style={({ pressed }) => ({ backgroundColor: colors.hiSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.hiInk }}>{f}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {onPostQuestion ? (
            <Pressable
              onPress={() => {
                hapticSelect();
                onPostQuestion();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.line,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <ChatsCircle size={16} color={colors.hi} weight="bold" />
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.hi }}>
                {answer.enough ? 'Still unsure? Ask the community directly' : 'Post this question to owners'}
              </Text>
            </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function CiteRow({ cite, onOpen }: { cite: AskCite; onOpen?: (url: string) => void }) {
  return (
    <Pressable
      disabled={!cite.url}
      onPress={() => cite.url && onOpen?.(cite.url)}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, backgroundColor: colors.lac2, borderRadius: 14, padding: 10, opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar name={cite.author} uri={cite.avatar} size={24} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.bone }}>{cite.author}</Text>
          <PlatformTag platform={cite.platform} />
        </View>
        <Text numberOfLines={3} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.bone2 }}>{cite.text}</Text>
      </View>
    </Pressable>
  );
}

function ReadingPeople() {
  const pulse = useRef(new Animated.Value(0.35)).current;
  const [step, setStep] = useState(0);
  const lines = ['Reading what owners said…', 'Checking community replies…', 'Weighing who agrees…'];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    const t = setInterval(() => setStep((s) => (s + 1) % lines.length), 1800);
    return () => {
      loop.stop();
      clearInterval(t);
    };
  }, [pulse, lines.length]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Animated.View style={{ opacity: pulse }}>
        <AvatarStack people={[{ name: 'A K' }, { name: 'M O' }, { name: 'T J' }]} size={22} />
      </Animated.View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>{lines[step]}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Joining — a name is all it takes to be a member.

export function useMemberGate(): { requireMember: (then: () => void) => void; gate: ReactNode } {
  const profile = useAppStore((s) => s.profile);
  const join = useAppStore((s) => s.joinCommunity);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [name, setName] = useState('');
  const requireMember = (then: () => void) => {
    if (profile) then();
    else setPending(() => then);
  };
  const gate = (
    <Modal visible={Boolean(pending)} transparent animationType="fade" onRequestClose={() => setPending(null)}>
      <Pressable onPress={() => setPending(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.wine, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 14, paddingBottom: 34 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AvatarStack people={[{ name: 'Ada N' }, { name: 'Kofi B' }, { name: 'Sam R' }, { name: 'Lina M' }]} size={30} ring={colors.wine} />
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setPending(null)} hitSlop={10}>
              <X size={20} color={colors.bone2} weight="bold" />
            </Pressable>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.6, color: colors.bone }}>Join the people who’ve used it</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.bone2 }}>
            Real owners answer here. Pick the name they’ll see next to your question or story.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Your name or nickname"
            placeholderTextColor={colors.bone3}
            maxLength={40}
            style={{ height: 50, backgroundColor: colors.lac, borderRadius: 14, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 16, color: colors.bone, outlineStyle: 'none' } as never}
          />
          <Pressable
            disabled={name.trim().length < 2}
            onPress={() => {
              join(name);
              hapticSuccess();
              const next = pending;
              setPending(null);
              setTimeout(() => next?.(), 50);
            }}
            style={({ pressed }) => ({
              height: 50,
              borderRadius: 14,
              backgroundColor: colors.hi,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: name.trim().length < 2 ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.white }}>Join the community</Text>
          </Pressable>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, textAlign: 'center' }}>
            No password. Be kind, be specific, and never post links to sell.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
  return { requireMember, gate };
}

// ---------------------------------------------------------------------------
// Scrollable pill tabs — for screens with more sections than a segmented control holds.

export function PillTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) hapticSelect();
              onChange(o.id);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 36,
              paddingHorizontal: 15,
              borderRadius: 999,
              backgroundColor: on ? colors.black : colors.lac,
              borderWidth: on ? 0 : 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.white : colors.bone }}>{o.label}</Text>
            {o.count ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: on ? 'rgba(255,255,255,0.6)' : colors.bone3 }}>{o.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionHead({ title, action, onAction, icon }: { title: string; action?: string; onAction?: () => void; icon?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon}
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A product people are looking at right now, with the human signal behind its rank. */
export function TrendingCard({ item, rank, onPress }: { item: TrendingProduct; rank: number; onPress: () => void }) {
  const signal = [
    item.views ? `${compact(item.views)} looking` : '',
    item.asks ? `${item.asks} asked` : '',
    item.compares ? `${item.compares} compared` : '',
  ].filter(Boolean)[0] || 'Being researched';
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ width: 148, gap: 8, opacity: pressed ? 0.8 : 1 })}
    >
      <View>
        <ProductImage uri={item.image} category={item.category} size={148} radius={20} />
        <View style={{ position: 'absolute', top: 8, left: 8, minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.white }}>{rank}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 17, color: colors.bone }}>
        {item.name}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hi }} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>{signal}</Text>
      </View>
    </Pressable>
  );
}

export { Sparkle as RevealIcon };
