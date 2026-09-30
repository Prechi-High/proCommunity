import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnswerCard, AskOwners, AvatarStack, SectionHead, useMemberGate } from '@/components/community';
import { ArrowLeft, ArrowsLeftRight, ArrowSquareOut, ChatsCircle, MagnifyingGlass, Plus, Trophy, X } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage, ProductRow, ScoreDial, SearchBar, Shimmer } from '@/components/kit';
import { openLink } from '@/components/product/Panes';
import { colors, fonts } from '@/constants/theme';
import { askOwners, fetchCompareAspects, fetchCompareFocus, postThread, trackProduct, type CompareFocus } from '@/lib/community';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import { displayName, formatPrice, getKnownProduct, investigateProduct, profileToProduct, rememberProduct, searchProducts } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import { MAX_COMPARE } from '@/lib/useScan';
import type { Product, ProductProfile } from '@/lib/types';

function param(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s : null;
}

function initialSlots(params: { ids?: string; a?: string; b?: string }): (string | null)[] {
  const ids = (param(params.ids) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const list = ids.length ? ids : [param(params.a), param(params.b)];
  const unique = [...new Set(list.filter(Boolean))].slice(0, MAX_COMPARE) as string[];
  return unique.length >= 2 ? unique : [...unique, ...Array(2 - unique.length).fill(null)];
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
  const params = useLocalSearchParams<{ ids?: string; a?: string; b?: string; from?: string }>();
  const [slots, setSlots] = useState<(string | null)[]>(() => initialSlots(params));
  const [picking, setPicking] = useState<number | null>(() => {
    const i = initialSlots(params).indexOf(null);
    return i >= 0 ? i : null;
  });
  const [aspect, setAspect] = useState<string | null>(null);
  const { requireMember, gate } = useMemberGate();
  useAppStore((s) => s.knownProducts);

  const intel = useQueries({
    queries: slots.map((id) => ({
      queryKey: ['intel', id],
      queryFn: () => investigateProduct({ id: id! }),
      enabled: Boolean(id),
      staleTime: 30 * 60_000,
      retry: 1,
    })),
  });

  const filled = slots.filter(Boolean) as string[];
  const profiles = slots.map((_, i) => intel[i]?.data ?? null);
  const ready = filled.length >= 2 && slots.every((id, i) => !id || Boolean(profiles[i]));
  const pairKey = filled.join('|');
  const names = slots.map((id, i) => nameOf(id, profiles[i]));
  const refs = slots
    .map((id, i) => (id ? { id, name: names[i], category: profiles[i]?.identity.category || getKnownProduct(id)?.category || '' } : null))
    .filter(Boolean) as { id: string; name: string; category: string }[];

  const aspects = useQuery({
    queryKey: ['compare-aspects', pairKey],
    queryFn: () => fetchCompareAspects(refs),
    enabled: filled.length >= 2,
    staleTime: 6 * 3600_000,
    retry: 1,
  });

  const focus = useMutation({ mutationFn: (a: string) => fetchCompareFocus(refs, a) });

  const take = useMutation({
    mutationFn: () => askOwners(filled[0], 'Which one should I pick, and what do owners say is the real difference?', filled[1], filled.slice(2)),
  });
  const asked = useRef('');
  useEffect(() => {
    if (!ready || asked.current === pairKey) return;
    asked.current = pairKey;
    take.reset();
    take.mutate();
    slots.forEach((id, i) => id && trackProduct(productOf(id, profiles[i]), 'compare'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pairKey]);

  useEffect(() => {
    setAspect(null);
    focus.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  const post = useMutation({
    mutationFn: (title: string) =>
      postThread({
        product: productOf(filled[0], profiles[slots.indexOf(filled[0])]),
        compare: productOf(filled[1], profiles[slots.indexOf(filled[1])]),
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

  const choose = (slot: number, product: Product) => {
    hapticSelect();
    rememberProduct(product);
    const next = slots.map((s, i) => (i === slot ? product.id : s));
    setSlots(next);
    const empty = next.indexOf(null);
    setPicking(empty >= 0 ? empty : null);
  };

  const clear = (slot: number) => {
    hapticTap();
    if (slots.length > 2) {
      const next = slots.filter((_, i) => i !== slot);
      setSlots(next);
      setPicking(next.indexOf(null) >= 0 ? next.indexOf(null) : null);
      return;
    }
    setSlots((s) => s.map((x, i) => (i === slot ? null : x)));
    setPicking(slot);
  };

  const addSlot = () => {
    hapticTap();
    setSlots((s) => [...s, null]);
    setPicking(slots.length);
  };

  const pickAspect = (a: string) => {
    hapticSelect();
    setAspect(a);
    focus.mutate(a);
  };

  const defaultTitle = `${names.filter(Boolean).join(' or ')}? Which would you pick?`;

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
            {slots.length > 2 ? `${slots.length} products` : 'Two products'}, judged by the people who actually used them.
          </Text>
          {param(params.from) === 'scan' ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.hiInk }}>Spotted together in your photo.</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
          {slots.map((id, i) => (
            <SlotCard
              key={`${i}-${id ?? 'empty'}`}
              id={id}
              name={names[i]}
              profile={profiles[i]}
              loading={Boolean(id) && Boolean(intel[i]?.isLoading)}
              active={picking === i}
              compact={slots.length > 2}
              onPick={() => setPicking(i)}
              onClear={() => clear(i)}
            />
          ))}
        </View>
        {slots.length < MAX_COMPARE && filled.length === slots.length ? (
          <Pressable onPress={addSlot} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: -6 }}>
            <Plus size={14} color={colors.hi} weight="bold" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>Add a {slots.length === 2 ? 'third' : 'another'} product</Text>
          </Pressable>
        ) : null}

        {picking !== null ? (
          <Picker exclude={slots} onChoose={(p) => choose(picking, p)} slotLabel={['first', 'second', 'third'][picking] ?? 'next'} />
        ) : null}

        {filled.length >= 2 ? (
          <AspectPicker
            names={names.filter(Boolean)}
            loading={aspects.isLoading}
            error={aspects.isError}
            aspects={aspects.data?.aspects ?? []}
            kind={aspects.data?.kind ?? ''}
            selected={aspect}
            onPick={pickAspect}
            onRetry={() => void aspects.refetch()}
          />
        ) : null}

        {aspect ? (
          <FocusCard
            aspect={aspect}
            loading={focus.isPending}
            error={focus.isError}
            data={focus.data ?? null}
            onRetry={() => focus.mutate(aspect)}
          />
        ) : null}

        {filled.length >= 2 && !ready ? (
          intel.some((q) => q.isError) ? (
            <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>One of these didn’t finish loading</Text>
              <PrimaryButton label="Try again" onPress={() => intel.forEach((q) => q.isError && void q.refetch())} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>Reading what owners of each said…</Text>
              <Shimmer height={120} radius={20} />
              <Shimmer height={180} radius={20} />
            </View>
          )
        ) : null}

        {ready ? (
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

            <Compared list={profiles.filter(Boolean) as ProductProfile[]} />

            <View style={{ gap: 10 }}>
              <SectionHead title={slots.length > 2 ? 'Ask owners of these' : 'Ask owners of both'} />
              <AskOwners
                productId={filled[0]}
                compareId={filled[1]}
                placeholder="Which is better for… / I’m worried about…"
                suggestions={['Which lasts longer?', 'Which is better value for money?', 'Which one do people regret buying?', 'Which is easier to use every day?']}
                onPostQuestion={(q) => requireMember(() => post.mutate(q))}
                onOpen={(url) => void openLink(url)}
              />
            </View>

            <View style={{ backgroundColor: colors.black, borderRadius: 22, padding: 18, gap: 12 }}>
              <AvatarStack people={[{ name: 'Ada N' }, { name: 'Kofi B' }, { name: 'Sam R' }]} size={26} ring={colors.black} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4, color: colors.white }}>Still torn? Let the community weigh in.</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)' }}>
                We’ll post “{defaultTitle}” so owners can tell you how it went.
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

function AspectPicker({
  names,
  loading,
  error,
  aspects,
  kind,
  selected,
  onPick,
  onRetry,
}: {
  names: string[];
  loading: boolean;
  error: boolean;
  aspects: { label: string; why: string }[];
  kind: string;
  selected: string | null;
  onPick: (a: string) => void;
  onRetry: () => void;
}) {
  const [custom, setCustom] = useState('');
  const submitCustom = () => {
    const a = custom.trim();
    if (a.length >= 2) {
      onPick(a);
      setCustom('');
    }
  };
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 22, padding: 16, gap: 12 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone }}>What are you comparing them for?</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.bone2 }}>
          {kind ? `What people usually compare ${kind.toLowerCase()} like these on.` : `What people usually compare ${names.join(' and ')} on.`} Pick one and we’ll look it up.
        </Text>
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[110, 140, 96, 128, 104].map((w) => (
            <Shimmer key={w} height={36} width={w} radius={999} />
          ))}
        </View>
      ) : error || !aspects.length ? (
        <Pressable onPress={onRetry} hitSlop={6}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.bone2 }}>
            Couldn’t load suggestions. <Text style={{ color: colors.hi }}>Try again</Text> — or type what matters to you below.
          </Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          {aspects.map((a) => {
            const on = selected === a.label;
            return (
              <Pressable
                key={a.label}
                onPress={() => onPick(a.label)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderRadius: 14,
                  backgroundColor: on ? colors.hi : colors.lac2,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: on ? colors.white : colors.bone }}>{a.label}</Text>
                  {a.why ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: on ? 'rgba(255,255,255,0.8)' : colors.bone3 }}>{a.why}</Text> : null}
                </View>
                <MagnifyingGlass size={15} color={on ? colors.white : colors.bone3} weight="bold" />
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingLeft: 14, paddingRight: 6, height: 46 }}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={submitCustom}
          placeholder="Something else? e.g. gaming, travel, oily skin"
          placeholderTextColor={colors.bone3}
          maxLength={60}
          returnKeyType="search"
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.bone, outlineStyle: 'none' } as never}
        />
        <Pressable
          onPress={submitCustom}
          disabled={custom.trim().length < 2}
          accessibilityLabel="Compare on this"
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: custom.trim().length >= 2 ? colors.hi : colors.lac2, alignItems: 'center', justifyContent: 'center' }}
        >
          <MagnifyingGlass size={15} color={custom.trim().length >= 2 ? colors.white : colors.bone3} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

function FocusCard({ aspect, loading, error, data, onRetry }: { aspect: string; loading: boolean; error: boolean; data: CompareFocus | null; onRetry: () => void }) {
  return (
    <View style={{ backgroundColor: colors.black, borderRadius: 22, padding: 18, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Eyebrow color="rgba(255,255,255,0.6)">Compared for</Eyebrow>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.5, color: colors.white }}>{aspect}</Text>
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.white} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Searching tests, reviews and owner reports…</Text>
        </View>
      ) : error || !data ? (
        <Pressable onPress={onRetry} hitSlop={6}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
            That search didn’t finish. <Text style={{ color: colors.hi }}>Try again</Text>
          </Text>
        </Pressable>
      ) : (
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.white }}>{data.summary}</Text>
          <View style={{ gap: 10 }}>
            {data.products.map((p, i) => {
              const won = data.winner === i;
              return (
                <View key={p.id || p.name} style={{ backgroundColor: won ? colors.hi : 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>{p.name}</Text>
                    {won ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Trophy size={12} color={colors.white} weight="fill" />
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.white }}>Better here</Text>
                      </View>
                    ) : null}
                  </View>
                  {p.verdict ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.9)' }}>{p.verdict}</Text> : null}
                  {p.points.map((pt) => (
                    <View key={pt} style={{ flexDirection: 'row', gap: 7 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', marginTop: 8 }} />
                      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.8)' }}>{pt}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
          {data.sources.length ? (
            <View style={{ gap: 6 }}>
              <Eyebrow color="rgba(255,255,255,0.5)">Sources</Eyebrow>
              {data.sources.slice(0, 5).map((s) => (
                <Pressable key={s.n} onPress={() => void openLink(s.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 18 }}>{s.n}</Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    {s.title} · {s.domain}
                  </Text>
                  <ArrowSquareOut size={13} color="rgba(255,255,255,0.5)" weight="bold" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function SlotCard({
  id,
  name,
  profile,
  loading,
  active,
  compact,
  onPick,
  onClear,
}: {
  id: string | null;
  name: string;
  profile: ProductProfile | null;
  loading: boolean;
  active: boolean;
  compact: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!id) {
    return (
      <Pressable
        onPress={onPick}
        style={{
          flex: 1,
          minHeight: compact ? 160 : 190,
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
    <View style={{ flex: 1, backgroundColor: colors.lac, borderRadius: 20, padding: compact ? 10 : 12, gap: 8, alignItems: 'center' }}>
      <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Remove" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
        <X size={14} color={colors.bone3} weight="bold" />
      </Pressable>
      <ProductImage uri={image} category={profile?.identity.category || known?.category || ''} size={compact ? 56 : 72} radius={16} />
      <Text numberOfLines={compact ? 3 : 2} style={{ fontFamily: fonts.semibold, fontSize: compact ? 12.5 : 14, lineHeight: compact ? 16 : 18, color: colors.bone, textAlign: 'center' }}>
        {name}
      </Text>
      {loading ? (
        <Shimmer height={48} width={48} radius={24} />
      ) : profile ? (
        <>
          <ScoreDial score={profile.score} size={compact ? 48 : 58} stroke={compact ? 5 : 6} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{lowest ? formatPrice(lowest.price) : '—'}</Text>
          {!compact ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.bone3, textAlign: 'center' }}>{profile.voices?.length ?? 0} owner voices</Text>
          ) : null}
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
      <SearchBar value={text} onChangeText={setText} onSubmit={() => setTerm(text.trim())} placeholder={`Search the ${slotLabel} product`} busy={results.isFetching} />
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

type Win = number | null;

function Compared({ list }: { list: ProductProfile[] }) {
  const specs = useMemo(() => {
    const [first, ...rest] = list;
    const maps = rest.map((p) => new Map(p.specs.map((s) => [norm(s.label), s.value])));
    const rows: { label: string; values: string[] }[] = [];
    for (const s of first?.specs ?? []) {
      const others = maps.map((m) => m.get(norm(s.label)));
      if (others.every(Boolean)) rows.push({ label: s.label, values: [s.value, ...(others as string[])] });
      if (rows.length >= 8) break;
    }
    return rows;
  }, [list]);

  const best = (values: (number | null | undefined)[], lowerWins = false): Win => {
    const nums = values.map((v) => (v == null ? null : v));
    if (nums.some((v) => v == null)) return null;
    const target = lowerWins ? Math.min(...(nums as number[])) : Math.max(...(nums as number[]));
    const idx = nums.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0);
    return idx.length === 1 ? idx[0] : null;
  };

  const lows = list.map((p) => p.offers.find((o) => o.price)?.price ?? null);
  const sameCurrency = lows.every((l) => l && l.currency === lows[0]?.currency);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: colors.lac, borderRadius: 20, overflow: 'hidden' }}>
        <Row label="Owner score" values={list.map((p) => (p.score != null ? String(p.score) : '—'))} win={best(list.map((p) => p.score))} />
        <Row label="Rating" values={list.map((p) => (p.rating ? `${p.rating.toFixed(1)} ★` : '—'))} win={best(list.map((p) => p.rating))} />
        <Row label="Lowest price" values={lows.map((l) => (l ? formatPrice(l) : '—'))} win={sameCurrency ? best(lows.map((l) => l?.amount), true) : null} />
        <Row label="People heard" values={list.map((p) => String(p.people?.voices ?? p.voices?.length ?? 0))} win={null} />
        {specs.map((s) => (
          <Row key={s.label} label={s.label} values={s.values} win={null} />
        ))}
      </View>

      <Columns title="Loved for" tone="good" cols={list.map((p) => p.praise.slice(0, 3).map((x) => x.text))} />
      <Columns title="Watch out" tone="warn" cols={list.map((p) => p.complaints.slice(0, 3).map((x) => x.text))} />
      <Columns title="Best for" tone="accent" cols={list.map((p) => p.bestFor.slice(0, 3))} />
    </View>
  );
}

function Row({ label, values, win }: { label: string; values: string[]; win: Win }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.bone3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {values.map((v, i) => (
          <Text
            key={i}
            style={{ flex: 1, fontFamily: win === i ? fonts.bold : fonts.medium, fontSize: values.length > 2 ? 13 : 14, lineHeight: 19, color: win === i ? colors.hi : colors.bone, textAlign: 'center' }}
          >
            {v}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Columns({ title, tone, cols }: { title: string; tone: 'good' | 'warn' | 'accent'; cols: string[][] }) {
  if (cols.every((c) => !c.length)) return null;
  const dot = tone === 'good' ? colors.sage : tone === 'warn' ? colors.coral : colors.hi;
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 10 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {cols.map((items, ci) => (
          <View key={ci} style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
            {ci > 0 ? <View style={{ width: 1, backgroundColor: colors.line }} /> : null}
            <View style={{ flex: 1, gap: 8 }}>
              {items.length ? (
                items.map((t) => (
                  <View key={t} style={{ flexDirection: 'row', gap: 7 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot, marginTop: 7 }} />
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: cols.length > 2 ? 12.5 : 13.5, lineHeight: 19, color: colors.bone }}>{t}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>Nothing reported</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
