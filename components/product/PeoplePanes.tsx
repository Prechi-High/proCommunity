import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  AskOwners,
  AvatarStack,
  Marker,
  peopleLine,
  SectionHead,
  ThreadCard,
  VoiceCard,
} from '@/components/community';
import {
  ArrowRight,
  ChatTeardropText,
  CheckCircle,
  Question,
  SealCheck,
  SmileyNervous,
  Sparkle,
  ThumbsDown,
  ThumbsUp,
  UsersThree,
  X,
} from '@/components/icons';
import { Eyebrow, Pill, ScoreDial, Tile } from '@/components/kit';
import { openLink } from '@/components/product/Panes';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { formatPrice, formatRange } from '@/lib/products';
import type { Cited, CommunityThread, ProductProfile, Stance, ThreadKind, Voice } from '@/lib/types';

const open = (url: string) => void openLink(url);

function verifiedLabel(iso: string): string {
  const days = Math.floor((Date.now() - +new Date(iso)) / 86_400_000);
  if (days <= 0) return 'checked today';
  if (days === 1) return 'checked yesterday';
  return `checked ${days} days ago`;
}

// ---------------------------------------------------------------------------
// Overview — the people behind the verdict, then what they revealed.

export function OverviewPane({
  profile,
  threads,
  onGo,
  onOpenSources,
}: {
  profile: ProductProfile;
  threads: CommunityThread[];
  onGo: (tab: 'owners' | 'discuss' | 'prices') => void;
  onOpenSources: () => void;
}) {
  const voices = profile.voices ?? [];
  const reveals = profile.reveals ?? [];
  const headline = profile.consensus || profile.verdict || profile.summary;
  const range = formatRange(profile.priceRange);
  const voiceById = useMemo(() => new Map(voices.map((v) => [v.id, v])), [voices]);
  const revealDone = 500 + reveals.reduce((t, r) => t + Math.max(4, r.mark.split(/\s+/).length * 2) * 55 + 250, 0);

  return (
    <View style={{ gap: 14 }}>
      <Tile tone="ink" style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {voices.length ? (
            <AvatarStack people={voices.map((v) => ({ name: v.author, avatar: v.avatar }))} size={24} max={5} ring={colors.black} />
          ) : (
            <UsersThree size={18} color="rgba(255,255,255,0.7)" weight="bold" />
          )}
          <Eyebrow color="rgba(255,255,255,0.6)">What owners concluded</Eyebrow>
        </View>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Marker
            text={headline || 'We gathered what people who used it are saying.'}
            marks={[profile.consensusMark]}
            dark
            delay={350}
            style={{ flex: 1, fontFamily: fonts.medium, fontSize: 17, lineHeight: 24, color: colors.white, letterSpacing: -0.2 }}
          />
          <View style={{ alignItems: 'center', gap: 3 }}>
            <ScoreDial score={profile.score} size={76} stroke={7} onDark />
            <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>owner score</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>{peopleLine(profile)}</Text>
      </Tile>

      {reveals.length ? (
        <Tile style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkle size={15} color={colors.hi} weight="fill" />
            <Eyebrow color={colors.hi}>Revealed by owners</Eyebrow>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone, marginTop: -6 }}>
            What the box won’t tell you
          </Text>
          {reveals.map((r, i) => {
            const backers = r.voiceIds.map((id) => voiceById.get(id)).filter(Boolean) as Voice[];
            const before = reveals.slice(0, i).reduce((t, x) => t + Math.max(4, x.mark.split(/\s+/).length * 2) * 55 + 250, 500);
            return (
              <View key={r.text} style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.bone3, width: 16 }}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 6 }}>
                  <Marker
                    text={r.text}
                    marks={[r.mark]}
                    delay={before}
                    style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, color: colors.bone }}
                  />
                  {backers.length ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AvatarStack people={backers.map((b) => ({ name: b.author, avatar: b.avatar }))} size={18} max={3} />
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                        {backers.length === 1 ? `said by ${backers[0].author}` : `${backers[0].author} and ${backers.length - 1} more`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          <NowYouKnow delay={revealDone} />
        </Tile>
      ) : null}

      {voices.length ? (
        <View style={{ gap: 10 }}>
          <SectionHead title="Owners are saying" action={`All ${voices.length}`} onAction={() => onGo('owners')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginRight: -16 }}>
            {voices.slice(0, 6).map((v, i) => (
              <VoiceCard key={v.id} voice={v} onOpen={open} delay={900 + i * 300} style={{ width: 300 }} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Tile style={{ flex: 1, minHeight: 100, justifyContent: 'space-between' }} onPress={() => onGo('owners')}>
          <Eyebrow>Rated by people</Eyebrow>
          {profile.rating ? (
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, letterSpacing: -1, color: colors.bone }}>
                {profile.rating.toFixed(1)}
                <Text style={{ fontSize: 15, color: colors.bone3 }}> / 5</Text>
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                {profile.ratingCount ? `${profile.ratingCount.toLocaleString()} buyers` : 'store ratings'}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>
              {profile.praise.length} praised · {profile.complaints.length} flagged
            </Text>
          )}
        </Tile>
        <Tile style={{ flex: 1, minHeight: 100, justifyContent: 'space-between' }} onPress={() => onGo('prices')}>
          <Eyebrow>Paying</Eyebrow>
          {range ? (
            <View style={{ gap: 2 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.8, color: colors.bone }}>
                {formatPrice(profile.offers[0]?.price) || range}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
                lowest of {profile.priceRange?.count ?? profile.offers.length} sellers
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>No live listings yet</Text>
          )}
        </Tile>
      </View>

      <Tile onPress={() => onGo('discuss')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.hiSoft }}>
        {threads.length ? (
          <AvatarStack people={threads.map((t) => ({ name: t.author_name }))} size={30} max={3} ring={colors.hiSoft} />
        ) : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
            <UsersThree size={20} color={colors.white} weight="bold" />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, color: colors.hiInk }}>
            {threads.length
              ? `${threads.length} ${threads.length === 1 ? 'conversation' : 'conversations'} about this`
              : 'Got a question or a worry?'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.hiInk, opacity: 0.8 }}>
            Ask the owners anything — like you’d ask a friend.
          </Text>
        </View>
        <ArrowRight size={18} color={colors.hi} weight="bold" />
      </Tile>

      <Pressable onPress={onOpenSources} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
        <Pill
          label={`${profile.band} confidence`}
          tone={profile.band === 'High' ? 'good' : profile.band === 'Likely' ? 'accent' : 'warn'}
          icon={SealCheck}
        />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
          {profile.sources.length} sources · {verifiedLabel(profile.verifiedAt)}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>Receipts</Text>
      </Pressable>
    </View>
  );
}

function NowYouKnow({ delay }: { delay: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!on) return <View style={{ height: 18 }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <CheckCircle size={15} color={colors.sage} weight="fill" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.sageInk }}>Now you know what owners know.</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Owners — every voice, filterable, then the patterns across reviews.

function CitedList({ items, tone, profile }: { items: Cited[]; tone: 'good' | 'bad'; profile: ProductProfile }) {
  const color = tone === 'good' ? colors.sage : colors.honey;
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 16, paddingHorizontal: 16 }}>
      {items.map((item, i) => {
        const src = item.source == null ? undefined : profile.sources.find((s) => s.n === item.source);
        return (
          <Pressable
            key={`${item.text}-${i}`}
            disabled={!src}
            onPress={() => src && open(src.url)}
            style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: colors.line }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 7 }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.bone }}>{item.text}</Text>
              {src ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  {src.kind === 'community' ? 'People on ' : 'Reviewers on '}
                  {src.domain}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OwnersPane({ profile }: { profile: ProductProfile }) {
  const voices = profile.voices ?? [];
  const [filter, setFilter] = useState<'all' | Stance>('all');
  const counts = { love: 0, mixed: 0, warn: 0 } as Record<Stance, number>;
  voices.forEach((v) => (counts[v.stance] += 1));
  const shown = filter === 'all' ? voices : voices.filter((v) => v.stance === filter);
  const total = Math.max(1, voices.length);
  return (
    <View style={{ gap: 16 }}>
      <Tile style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AvatarStack people={voices.map((v) => ({ name: v.author, avatar: v.avatar }))} size={28} max={6} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>{peopleLine(profile)}</Text>
        </View>
        {voices.length ? (
          <>
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.wineDeep }}>
              <View style={{ width: `${(counts.love / total) * 100}%`, backgroundColor: colors.sage }} />
              <View style={{ width: `${(counts.mixed / total) * 100}%`, backgroundColor: colors.bone3 }} />
              <View style={{ width: `${(counts.warn / total) * 100}%`, backgroundColor: colors.coral }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(
                [
                  ['all', `Everyone ${voices.length}`],
                  ['love', `Love ${counts.love}`],
                  ['mixed', `Mixed ${counts.mixed}`],
                  ['warn', `Warn ${counts.warn}`],
                ] as const
              ).map(([id, label]) => {
                const on = filter === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      hapticSelect();
                      setFilter(id);
                    }}
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? colors.black : colors.lac2 }}
                  >
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: on ? colors.white : colors.bone2 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </Tile>

      {shown.map((v, i) => (
        <VoiceCard key={v.id} voice={v} onOpen={open} delay={200 + i * 250} />
      ))}
      {!voices.length ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center', paddingVertical: 8 }}>
          We haven’t found owners talking about this one yet — the patterns below come from reviews.
        </Text>
      ) : null}

      {profile.praise.length || profile.complaints.length ? (
        <SectionHead title="Patterns across reviews" />
      ) : null}
      {profile.praise.length ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThumbsUp size={14} color={colors.sage} weight="fill" />
            <Eyebrow color={colors.sageInk}>What keeps coming up as good</Eyebrow>
          </View>
          <CitedList items={profile.praise} tone="good" profile={profile} />
        </View>
      ) : null}
      {profile.complaints.length ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThumbsDown size={14} color={colors.coral} weight="fill" />
            <Eyebrow color={colors.coral}>What people warn about</Eyebrow>
          </View>
          <CitedList items={profile.complaints} tone="bad" profile={profile} />
        </View>
      ) : null}
      {profile.bestFor.length || profile.notFor.length ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {profile.bestFor.length ? (
            <Tile style={{ flex: 1, gap: 8 }}>
              <Eyebrow color={colors.sageInk}>Owners say it’s for</Eyebrow>
              {profile.bestFor.map((b) => (
                <View key={b} style={{ flexDirection: 'row', gap: 6 }}>
                  <CheckCircle size={14} color={colors.sage} weight="fill" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.bone }}>{b}</Text>
                </View>
              ))}
            </Tile>
          ) : null}
          {profile.notFor.length ? (
            <Tile style={{ flex: 1, gap: 8 }}>
              <Eyebrow color={colors.coral}>Skip it if</Eyebrow>
              {profile.notFor.map((b) => (
                <View key={b} style={{ flexDirection: 'row', gap: 6 }}>
                  <X size={14} color={colors.coral} weight="bold" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.bone }}>{b}</Text>
                </View>
              ))}
            </Tile>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Discuss — ask the owners, or start a conversation of your own.

const KINDS: { id: Exclude<ThreadKind, 'compare'>; label: string; Icon: typeof Question; hint: string }[] = [
  { id: 'question', label: 'Question', Icon: Question, hint: 'What do you want to know?' },
  { id: 'worry', label: 'Worry', Icon: SmileyNervous, hint: 'What are you afraid might go wrong?' },
  { id: 'experience', label: 'I own it', Icon: ChatTeardropText, hint: 'What should the next buyer know?' },
];

export function suggestionsFor(profile: ProductProfile | null): string[] {
  const out = ['Is it worth the price?', 'Any problems after a few months?'];
  const best = profile?.bestFor[0];
  if (best) out.push(`Is it good for ${best.charAt(0).toLowerCase()}${best.slice(1, 40)}?`);
  const worry = profile?.complaints[0]?.text;
  if (worry) out.push(`How common is this: ${worry.slice(0, 44).toLowerCase()}?`);
  out.push('What do owners regret?');
  return out;
}

export function DiscussPane({
  profile,
  productId,
  threads,
  loading,
  draft,
  onDraft,
  posting,
  onPost,
  onOpenThread,
}: {
  profile: ProductProfile;
  productId: string;
  threads: CommunityThread[];
  loading: boolean;
  draft: { kind: Exclude<ThreadKind, 'compare'>; title: string };
  onDraft: (d: { kind: Exclude<ThreadKind, 'compare'>; title: string }) => void;
  posting: boolean;
  onPost: () => void;
  onOpenThread: (id: string) => void;
}) {
  const kind = KINDS.find((k) => k.id === draft.kind) ?? KINDS[0];
  return (
    <View style={{ gap: 18 }}>
      <AskOwners
        productId={productId}
        suggestions={suggestionsFor(profile)}
        onOpen={open}
        onPostQuestion={(q) => onDraft({ kind: 'question', title: q })}
      />

      <View style={{ gap: 10 }}>
        <SectionHead title="Talk to the community" />
        <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {KINDS.map((k) => {
              const on = k.id === draft.kind;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => {
                    hapticSelect();
                    onDraft({ ...draft, kind: k.id });
                  }}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: on ? colors.black : colors.lac2,
                  }}
                >
                  <k.Icon size={14} color={on ? colors.white : colors.bone2} weight="bold" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? colors.white : colors.bone2 }}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={draft.title}
            onChangeText={(title) => onDraft({ ...draft, title })}
            placeholder={kind.hint}
            placeholderTextColor={colors.bone3}
            multiline
            maxLength={280}
            style={
              {
                minHeight: 64,
                backgroundColor: colors.lac2,
                borderRadius: 14,
                padding: 12,
                fontFamily: fonts.regular,
                fontSize: 15,
                lineHeight: 21,
                color: colors.bone,
                textAlignVertical: 'top',
                outlineStyle: 'none',
              } as never
            }
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
              {draft.kind === 'experience' ? 'Your story helps the next buyer decide.' : 'Specific questions get answered faster.'}
            </Text>
            <Pressable
              disabled={draft.title.trim().length < 6 || posting}
              onPress={onPost}
              style={({ pressed }) => ({
                height: 38,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: colors.hi,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: draft.title.trim().length < 6 ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              {posting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Post</Text>}
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {loading ? (
          <ActivityIndicator color={colors.hi} />
        ) : threads.length ? (
          threads.map((t) => <ThreadCard key={t.id} thread={t} onPress={() => onOpenThread(t.id)} showProduct={Boolean(t.compare_id)} />)
        ) : (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
            <AvatarStack people={[{ name: 'Ada N' }, { name: 'Kofi B' }, { name: 'Sam R' }]} size={30} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Start the first conversation</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.bone2, textAlign: 'center', lineHeight: 19 }}>
              Owners who’ve used {profile.identity.name || 'this'} will see your question.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}