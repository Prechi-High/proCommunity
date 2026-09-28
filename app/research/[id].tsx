import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrowClockwise, ArrowsLeftRight, PaperPlaneRight, ShareNetwork, Trash } from '@/components/icons';
import { Pill, ProductImage, Shimmer } from '@/components/kit';
import { SectionBlock, STATUS_TEXT, TopBar } from '@/components/research';
import { colors, fonts } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { hapticSuccess } from '@/lib/haptics';
import { isInFlight, research, ResearchApiError, STATUS_TONE } from '@/lib/research';

function ActionChip({ label, icon: I, onPress, busy, tone = 'plain' }: { label: string; icon: typeof ShareNetwork; onPress: () => void; busy?: boolean; tone?: 'plain' | 'danger' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: 19,
        backgroundColor: colors.lac,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: pressed || busy ? 0.6 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={colors.bone2} /> : <I size={15} color={tone === 'danger' ? colors.coral : colors.bone} weight="bold" />}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: tone === 'danger' ? colors.coral : colors.bone }}>{label}</Text>
    </Pressable>
  );
}

export default function ResearchCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [compareWith, setCompareWith] = useState('');
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const view = useQuery({
    queryKey: ['research', 'card', id],
    queryFn: () => research.get(String(id)),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data && isInFlight(q.state.data.card.status) ? 4000 : false),
    retry: (n, err) => !(err instanceof ResearchApiError && (err.status === 404 || err.status === 401)) && n < 2,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['research', 'card', id] });

  const ask = useMutation({
    mutationFn: (q: string) => research.ask(String(id), q),
    onSuccess: () => {
      setQuestion('');
      void refresh();
    },
    onError: () => setNotice('Couldn’t get an answer right now. Try again shortly.'),
  });
  const compare = useMutation({
    mutationFn: (t: string) => research.compare(String(id), t),
    onSuccess: () => {
      setCompareWith('');
      setComparing(false);
      void refresh();
    },
    onError: (e) => setNotice(e instanceof ResearchApiError && e.code === 'PRODUCT_NOT_IDENTIFIED' ? 'Couldn’t identify that product. Try the full brand and name.' : 'Comparison failed. Try again shortly.'),
  });
  const share = useMutation({
    mutationFn: () => research.share(String(id)),
    onSuccess: async ({ url }) => {
      hapticSuccess();
      track('research_card_shared', {});
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url).catch(() => undefined);
        setNotice(`Share link copied: ${url}`);
      } else {
        await Share.share({ message: url, url });
      }
      void refresh();
    },
    onError: (e) => setNotice(e instanceof ResearchApiError && e.code === 'INVALID_INPUT' ? 'You can share once research is ready.' : 'Couldn’t create a share link.'),
  });
  const revoke = useMutation({ mutationFn: () => research.revokeShares(String(id)), onSuccess: () => (setNotice('Sharing turned off. Old links no longer work.'), void refresh()) });
  const redo = useMutation({ mutationFn: () => research.refresh(String(id)), onSuccess: () => (setNotice('Refreshing with the latest evidence…'), void refresh()) });
  const archive = useMutation({
    mutationFn: () => research.archive(String(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['research', 'list'] });
      router.replace('/research' as Href);
    },
  });

  const data = view.data;
  const card = data?.card;
  const identity = data?.sections.find((s) => s.section_key === 'identity')?.content as { brand?: string; category?: string; variant?: string } | undefined;
  const ready = card && (card.status === 'complete' || card.status === 'partial');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <TopBar title={card ? `Research Card ${card.public_reference}` : 'Research Card'} fallback="/research" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 12 }} keyboardShouldPersistTaps="handled">
        {view.isLoading ? (
          <>
            <Shimmer height={120} radius={22} />
            <Shimmer height={160} radius={20} />
          </>
        ) : view.isError || !data || !card ? (
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 60 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>Research Card not found</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, color: colors.bone2, textAlign: 'center' }}>It may have been archived, or it belongs to another account.</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.lac, borderRadius: 22, padding: 14 }}>
              <ProductImage uri={card.image_url} category={identity?.category} size={84} radius={16} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 23, letterSpacing: -0.4, color: colors.bone }}>{card.title ?? 'Identifying product…'}</Text>
                {identity ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>{[identity.brand, identity.variant, identity.category].filter(Boolean).join(' · ')}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pill label={STATUS_TEXT[card.status]} tone={STATUS_TONE[card.status]} />
                  {isInFlight(card.status) ? <ActivityIndicator size="small" color={colors.hi} /> : null}
                </View>
              </View>
            </View>

            {isInFlight(card.status) ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2, textAlign: 'center' }}>{data.statusLabel} This usually takes under a minute.</Text>
            ) : null}
            {card.status === 'failed' ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.coral, textAlign: 'center' }}>Research couldn’t be completed. Try refreshing in a little while.</Text>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ready ? <ActionChip label={card.is_shared ? 'New share link' : 'Share'} icon={ShareNetwork} busy={share.isPending} onPress={() => share.mutate()} /> : null}
              {card.is_shared ? <ActionChip label="Stop sharing" icon={ShareNetwork} busy={revoke.isPending} onPress={() => revoke.mutate()} /> : null}
              {ready ? <ActionChip label="Compare" icon={ArrowsLeftRight} onPress={() => setComparing((v) => !v)} /> : null}
              {!isInFlight(card.status) ? <ActionChip label="Refresh" icon={ArrowClockwise} busy={redo.isPending} onPress={() => redo.mutate()} /> : null}
              <ActionChip label="Archive" icon={Trash} tone="danger" busy={archive.isPending} onPress={() => archive.mutate()} />
            </ScrollView>

            {notice ? (
              <Pressable onPress={() => setNotice(null)} style={{ backgroundColor: colors.hiSoft, borderRadius: 14, padding: 12 }}>
                <Text selectable style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.hiInk }}>{notice}</Text>
              </Pressable>
            ) : null}

            {comparing ? (
              <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 10 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Compare with another product</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={compareWith}
                    onChangeText={setCompareWith}
                    placeholder="Brand and product name"
                    placeholderTextColor={colors.bone3}
                    onSubmitEditing={() => compareWith.trim().length > 2 && compare.mutate(compareWith.trim())}
                    style={{ flex: 1, height: 44, backgroundColor: colors.wine, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.bone, outlineStyle: 'none' } as never}
                  />
                  <Pressable
                    disabled={compareWith.trim().length < 3 || compare.isPending}
                    onPress={() => compare.mutate(compareWith.trim())}
                    style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.hi, justifyContent: 'center', opacity: compareWith.trim().length < 3 ? 0.4 : 1 }}
                  >
                    {compare.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Compare</Text>}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {data.sections
              .filter((s) => s.section_key !== 'identity')
              .map((s) => (
                <SectionBlock key={s.section_key} section={s} />
              ))}

            {data.comparisons.length ? (
              <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 16, gap: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Comparisons</Text>
                {data.comparisons.map((c) => {
                  const s = c.comparison_snapshot ?? {};
                  return (
                    <View key={c.id} style={{ gap: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>
                        {s.a?.name}
                        {s.a?.score != null ? ` · ${s.a.score}` : ''} vs {s.b?.name}
                        {s.b?.score != null ? ` · ${s.b.score}` : ''}
                      </Text>
                      {s.verdict?.text ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{s.verdict.text}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {ready ? (
              <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 16, gap: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Ask about this product</Text>
                {data.questions.map((q) => (
                  <View key={q.id} style={{ gap: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone }}>{q.question}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: q.status === 'failed' ? colors.coral : colors.bone2 }}>
                      {q.status === 'answered' ? q.answer?.text : q.status === 'failed' ? 'No answer this time.' : 'Checking…'}
                    </Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="e.g. Is it good for sensitive skin?"
                    placeholderTextColor={colors.bone3}
                    maxLength={500}
                    onSubmitEditing={() => question.trim().length > 2 && ask.mutate(question.trim())}
                    style={{ flex: 1, height: 44, backgroundColor: colors.wine, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.bone, outlineStyle: 'none' } as never}
                  />
                  <Pressable
                    accessibilityLabel="Ask"
                    disabled={question.trim().length < 3 || ask.isPending}
                    onPress={() => ask.mutate(question.trim())}
                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center', opacity: question.trim().length < 3 ? 0.4 : 1 }}
                  >
                    {ask.isPending ? <ActivityIndicator color={colors.white} /> : <PaperPlaneRight size={18} color={colors.white} weight="fill" />}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {card.primary_product_id ? (
              <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: card.primary_product_id } } as unknown as Href)} style={{ alignSelf: 'center', paddingVertical: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>Open full product page</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
