import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnswerCard, AskOwners, AvatarStack, SectionHead, useMemberGate } from '@/components/community';
import { ArrowLeft, ArrowsLeftRight, ChatsCircle, Plus, X } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage, ProductRow, ScoreDial, SearchBar, Shimmer } from '@/components/kit';
import { openLink } from '@/components/product/Panes';
import { colors, fonts } from '@/constants/theme';
import { askOwners, postThread, trackProduct } from '@/lib/community';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { displayName, formatPrice, getKnownProduct, investigateProduct, profileToProduct, rememberProduct, searchProducts } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { Product, ProductProfile } from '@/lib/types';

type Slot = 'a' | 'b';

function param(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s : null;
}

function nameOf(id: string | null, profile: ProductProfile | null | undefined): string {
  if (profile?.identity.name) return displayName({ name: profile.identity.name, brand: profile.identity.brand });
  const known = id ? getKnownProduct(id) : undefined;
  return known ? displayName(known) : id?.replace(/-/g, ' ') ?? '';
}

function productOf(id: string, profile: ProductProfile | null | undefined): Product {
  const known = getKnownProduct(id);
  if (profile) return profileToProduct(profile, known);
  return known ?? { id, name: nameOf(id, null), brand: '', category: '' };
}

export default function CompareScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const [slots, setSlots] = useState<Record<Slot, string | null>>({ a: param(params.a), b: param(params.b) });
  const [picking, setPicking] = useState<Slot | null>(slots.a ? (slots.b ? null : 'b') : 'a');
  const { requireMember, gate } = useMemberGate();
  useAppStore((s) => s.knownProducts);

  const intelA = useQuery({
    queryKey: ['intel', slots.a],
    queryFn: () => investigateProduct({ id: slots.a! }),
    enabled: Boolean(slots.a),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const intelB = useQuery({
    queryKey: ['intel', slots.b],
    queryFn: () => investigateProduct({ id: slots.b! }),
    enabled: Boolean(slots.b),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const A = intelA.data ?? null;
  const B = intelB.data ?? null;
  const ready = Boolean(A && B);
  const pairKey = `${slots.a}|${slots.b}`;

  const take = useMutation({
    mutationFn: () => askOwners(slots.a!, 'Which one should I pick, and what do owners say is the real difference?', slots.b!),
  });
  const asked = useRef('');
  useEffect(() => {
    if (!ready || asked.current === pairKey) return;
    asked.current = pairKey;
    take.reset();
    take.mutate();
    trackProduct(productOf(slots.a!, A), 'compare');
    trackProduct(productOf(slots.b!, B), 'compare');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pairKey]);

  const post = useMutation({
    mutationFn: (title: string) =>
      postThread({
        product: productOf(slots.a!, A),
        compare: productOf(slots.b!, B),
        kind: 'compare',
        title,
      }),
    onSuccess: (thread) => {
      hapticSuccess();
      void qc.invalidateQueries({ queryKey: ['threads'] });
      void qc.invalidateQueries({ queryKey: ['pulse'] });
      router.push({ pathname: '/thread/[id]', params: { id: thread.id } } as Href);
    },
  });

  const choose = (slot: Slot, product: Product) => {
    hapticSelect();
    rememberProduct(product);
    const next = { ...slots, [slot]: product.id };
    setSlots(next);
    setPicking(next.a ? (next.b ? null : 'b') : 'a');
  };

  const clear = (slot: Slot) => {
    hapticTap();
    setSlots((s) => ({ ...s, [slot]: null }));
    setPicking(slot);
  };

  const nameA = nameOf(slots.a, A);
  const nameB = nameOf(slots.b, B);
  const defaultTitle = `${nameA} or ${nameB}? Which would you pick?`;

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
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Compare</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.8, color: colors.bone }}>Side by side</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.bone2 }}>
            Two products, judged by the people who actually used them.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
          <SlotCard id={slots.a} name={nameA} profile={A} loading={intelA.isLoading} active={picking === 'a'} onPick={() => setPicking('a')} onClear={() => clear('a')} />
          <View style={{ justifyContent: 'center' }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }}>VS</Text>
            </View>
          </View>
          <SlotCard id={slots.b} name={nameB} profile={B} loading={intelB.isLoading} active={picking === 'b'} onPick={() => setPicking('b')} onClear={() => clear('b')} />
        </View>

        {picking ? <Picker exclude={[slots.a, slots.b]} onChoose={(p) => choose(picking, p)} slotLabel={picking === 'a' ? 'first' : 'second'} /> : null}

        {slots.a && slots.b && !ready ? (
          intelA.isError || intelB.isError ? (
            <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>One of these didn’t finish loading</Text>
              <PrimaryButton
                label="Try again"
                onPress={() => {
                  if (intelA.isError) void intelA.refetch();
                  if (intelB.isError) void intelB.refetch();
                }}
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>Reading what owners of both said…</Text>
              <Shimmer height={120} radius={20} />
              <Shimmer height={180} radius={20} />
            </View>
          )
        ) : null}

        {ready && A && B ? (
          <>
            <View style={{ gap: 10 }}>
              <SectionHead title="Owners’ take" icon={<ChatsCircle size={20} color={colors.hi} weight="bold" />} />
              <AnswerCard
                question="Which one should I pick?"
                loading={take.isPending}
                error={take.isError}
                answer={take.data ?? null}
                onRetry={() => take.mutate()}
                onOpen={(url) => void openLink(url)}
              />
            </View>

            <Compared a={A} b={B} />

            <View style={{ gap: 10 }}>
              <SectionHead title="Ask owners of both" />
              <AskOwners
                productId={slots.a!}
                compareId={slots.b!}
                placeholder="Which is better for… / I’m worried about…"
                suggestions={[
                  'Which lasts longer?',
                  'Which is better value for money?',
                  'Which one do people regret buying?',
                  'Which is easier to use every day?',
                ]}
                onPostQuestion={(q) => requireMember(() => post.mutate(q))}
                onOpen={(url) => void openLink(url)}
              />
            </View>

            <View style={{ backgroundColor: colors.black, borderRadius: 22, padding: 18, gap: 12 }}>
              <AvatarStack people={[{ name: 'Ada N' }, { name: 'Kofi B' }, { name: 'Sam R' }]} size={26} ring={colors.black} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4, color: colors.white }}>
                Still torn? Let the community weigh in.
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)' }}>
                We’ll post “{defaultTitle}” so owners of either can tell you how it went.
              </Text>
              <PrimaryButton label={post.isPending ? 'Posting…' : 'Post this comparison'} icon={ArrowsLeftRight} onPress={() => requireMember(() => post.mutate(defaultTitle))} />
              {post.isError ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.coral }}>That didn’t post. Try again.</Text> : null}
            </View>
          </>
        ) : null}
      </ScrollView>
      {gate}
    </SafeAreaView>
  );
}

function SlotCard({
  id,
  name,
  profile,
  loading,
  active,
  onPick,
  onClear,
}: {
  id: string | null;
  name: string;
  profile: ProductProfile | null;
  loading: boolean;
  active: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!id) {
    return (
      <Pressable
        onPress={onPick}
        style={{
          flex: 1,
          minHeight: 190,
          borderRadius: 20,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: active ? colors.hi : colors.line,
          backgroundColor: active ? colors.hiSoft : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 12,
        }}
      >
        <Plus size={22} color={active ? colors.hi : colors.bone3} weight="bold" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: active ? colors.hiInk : colors.bone3, textAlign: 'center' }}>Add a product</Text>
      </Pressable>
    );
  }
  const known = getKnownProduct(id);
  const image = known?.heroImageUrl || profile?.images[0] || null;
  const lowest = profile?.offers.find((o) => o.price) ?? null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.lac, borderRadius: 20, padding: 12, gap: 8, alignItems: 'center' }}>
      <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Remove" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
        <X size={14} color={colors.bone3} weight="bold" />
      </Pressable>
      <ProductImage uri={image} category={profile?.identity.category || known?.category || ''} size={72} radius={16} />
      <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.bone, textAlign: 'center' }}>
        {name}
      </Text>
      {loading ? (
        <Shimmer height={56} width={56} radius={28} />
      ) : profile ? (
        <>
          <ScoreDial score={profile.score} size={58} stroke={6} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{lowest ? formatPrice(lowest.price) : '—'}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.bone3, textAlign: 'center' }}>
            {profile.voices?.length ?? 0} owner voices
          </Text>
        </>
      ) : null}
    </View>
  );
}

function Picker({ exclude, onChoose, slotLabel }: { exclude: (string | null)[]; onChoose: (p: Product) => void; slotLabel: string }) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const recentIds = useAppStore((s) => s.recentProductIds);
  const recents = useMemo(
    () => recentIds.filter((id) => !exclude.includes(id)).map((id) => getKnownProduct(id)).filter(Boolean).slice(0, 5) as Product[],
    [recentIds, exclude],
  );
  const results = useQuery({
    queryKey: ['search', term],
    queryFn: () => searchProducts(term),
    enabled: term.length > 1,
    staleTime: 10 * 60_000,
  });
  const list = term ? (results.data?.products ?? []).filter((p) => !exclude.includes(p.id)).slice(0, 6) : recents;
  return (
    <View style={{ gap: 10 }}>
      <SearchBar
        value={text}
        onChangeText={setText}
        onSubmit={() => setTerm(text.trim())}
        placeholder={`Search the ${slotLabel} product`}
        busy={results.isFetching}
      />
      {term && results.isLoading ? (
        <View style={{ gap: 8 }}>
          <Shimmer height={68} radius={14} />
          <Shimmer height={68} radius={14} />
        </View>
      ) : list.length ? (
        <View>
          {!term ? <Eyebrow>Recently viewed</Eyebrow> : null}
          {list.map((p) => (
            <ProductRow key={p.id} product={p} onPress={() => onChoose(p)} />
          ))}
        </View>
      ) : term ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Nothing found for “{term}”. Try the brand and model.</Text>
      ) : null}
    </View>
  );
}

function norm(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function Compared({ a, b }: { a: ProductProfile; b: ProductProfile }) {
  const specs = useMemo(() => {
    const bMap = new Map(b.specs.map((s) => [norm(s.label), s.value]));
    const rows: { label: string; a: string; b: string }[] = [];
    for (const s of a.specs) {
      const v = bMap.get(norm(s.label));
      if (v) rows.push({ label: s.label, a: s.value, b: v });
      if (rows.length >= 8) break;
    }
    return rows;
  }, [a, b]);

  const lowA = a.offers.find((o) => o.price)?.price ?? null;
  const lowB = b.offers.find((o) => o.price)?.price ?? null;

  const winner = (x: number | null | undefined, y: number | null | undefined, lowerWins = false): 'a' | 'b' | null => {
    if (x == null || y == null || x === y) return null;
    return (lowerWins ? x < y : x > y) ? 'a' : 'b';
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: colors.lac, borderRadius: 20, overflow: 'hidden' }}>
        <Row label="Owner score" a={a.score != null ? String(a.score) : '—'} b={b.score != null ? String(b.score) : '—'} win={winner(a.score, b.score)} />
        <Row
          label="Rating"
          a={a.rating ? `${a.rating.toFixed(1)} ★` : '—'}
          b={b.rating ? `${b.rating.toFixed(1)} ★` : '—'}
          win={winner(a.rating, b.rating)}
        />
        <Row label="Lowest price" a={lowA ? formatPrice(lowA) : '—'} b={lowB ? formatPrice(lowB) : '—'} win={lowA && lowB && lowA.currency === lowB.currency ? winner(lowA.amount, lowB.amount, true) : null} />
        <Row label="People heard" a={String(a.people?.voices ?? a.voices?.length ?? 0)} b={String(b.people?.voices ?? b.voices?.length ?? 0)} win={null} />
        {specs.map((s) => (
          <Row key={s.label} label={s.label} a={s.a} b={s.b} win={null} />
        ))}
      </View>

      <Columns title="Loved for" tone="good" a={a.praise.slice(0, 3).map((p) => p.text)} b={b.praise.slice(0, 3).map((p) => p.text)} />
      <Columns title="Watch out" tone="warn" a={a.complaints.slice(0, 3).map((p) => p.text)} b={b.complaints.slice(0, 3).map((p) => p.text)} />
      <Columns title="Best for" tone="accent" a={a.bestFor.slice(0, 3)} b={b.bestFor.slice(0, 3)} />
    </View>
  );
}

function Row({ label, a, b, win }: { label: string; a: string; b: string; win: 'a' | 'b' | null }) {
  const cell = (v: string, on: boolean) => (
    <Text style={{ flex: 1, fontFamily: on ? fonts.bold : fonts.medium, fontSize: 14, lineHeight: 19, color: on ? colors.hi : colors.bone, textAlign: 'center' }}>{v}</Text>
  );
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.bone3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {cell(a, win === 'a')}
        {cell(b, win === 'b')}
      </View>
    </View>
  );
}

function Columns({ title, tone, a, b }: { title: string; tone: 'good' | 'warn' | 'accent'; a: string[]; b: string[] }) {
  if (!a.length && !b.length) return null;
  const dot = tone === 'good' ? colors.sage : tone === 'warn' ? colors.coral : colors.hi;
  const col = (items: string[]) => (
    <View style={{ flex: 1, gap: 8 }}>
      {items.length ? (
        items.map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 7 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot, marginTop: 7 }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.bone }}>{t}</Text>
          </View>
        ))
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>Nothing reported</Text>
      )}
    </View>
  );
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 10 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {col(a)}
        <View style={{ width: 1, backgroundColor: colors.line }} />
        {col(b)}
      </View>
    </View>
  );
}
