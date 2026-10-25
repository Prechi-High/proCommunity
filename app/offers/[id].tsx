import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ActionButton, AppShell, MediaFrame, StatusMessage } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { db } from '@/lib/clarity/api';
import { safeLink } from '@/lib/profiles/api';
import { SAMPLE_OFFERS } from '@/lib/unmask/samples';
import * as api from '@/lib/team/api';

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const sample = SAMPLE_OFFERS.find((o) => o.id === id);
  const q = useQuery({
    queryKey: ['offers', 'detail', id],
    queryFn: () => api.offer(id),
    enabled: !!id && !sample,
  });
  const evidence = useQuery({
    queryKey: ['offer-evidence', q.data?.product_id],
    enabled: !!q.data,
    queryFn: async () => {
      const { count, error: err } = await db()
        .from('clarity_experiences')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', q.data!.product_id)
        .eq('visibility', 'public')
        .eq('moderation_status', 'visible');
      if (err) throw err;
      return count || 0;
    },
  });
  const investigations = useQuery({
    queryKey: ['offer-investigations', q.data?.product_id],
    enabled: !!q.data,
    queryFn: () =>
      api.read<{ id: string; title: string }[]>(
        db()
          .from('unmask_investigations')
          .select('id,title')
          .eq('product_id', q.data!.product_id)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(3),
      ),
  });
  const o = sample
    ? {
        ...sample,
        terms: 'Sample offer. No store checkout on this preview.',
        store_url: null as string | null,
        status: 'active',
        starts_at: null as string | null,
        expires_at: null as string | null,
      }
    : q.data;

  return (
    <AppShell back title={o?.unmask_catalog?.name || 'Offer'} subtitle={COPY.offersHook}>
      {q.isError && !sample ? <StatusMessage kind="error" title="This offer isn’t available." /> : null}
      {o ? (
        <>
          <MediaFrame uri={o.unmask_catalog?.image_url} label={o.unmask_catalog?.name || o.title} overlay />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
            {o.kind} · {o.sponsor}
            {sample ? ' · Sample' : ''}
          </Text>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.4 }}>
            {o.title}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{o.description}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>{o.disclosure}</Text>
          <ActionButton
            label="Unmask this product first"
            onPress={() => router.push(`/product/${o.product_id}` as Href)}
          />
          {sample ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
              {sample.experience_count} lived stories on the product page. Paid placement does not buy a finding.
            </Text>
          ) : (
            <>
              {evidence.isSuccess ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
                  {evidence.data} public lived stories
                </Text>
              ) : null}
              {(investigations.data ?? []).map((item) => (
                <ActionButton
                  key={item.id}
                  tone="secondary"
                  label={item.title}
                  onPress={() => router.push(`/investigation/${item.id}` as Href)}
                />
              ))}
            </>
          )}
          {o.store_url && safeLink(o.store_url) ? (
            <ActionButton tone="ghost" label="Visit store" onPress={() => setLeaving(true)} />
          ) : null}
          <ActionButton tone="ghost" label={terms ? 'Hide offer terms' : 'Offer terms'} onPress={() => setTerms((v) => !v)} />
          {terms ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
              {'terms' in o && o.terms ? o.terms : 'No extra terms. Check the seller before you buy.'}
            </Text>
          ) : null}
          {leaving && o.store_url && safeLink(o.store_url) ? (
            <View style={{ gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.stage }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>You’re leaving Unmask.</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
                The store is not us. Unmask the product before you pay if you haven’t yet.
              </Text>
              <ActionButton label="Continue to store" onPress={() => void Linking.openURL(o.store_url!).catch(() => setError('Could not open the store.'))} />
              <ActionButton tone="ghost" label="Stay here" onPress={() => setLeaving(false)} />
            </View>
          ) : null}
        </>
      ) : null}
      {error ? <StatusMessage kind="error" title={error} /> : null}
    </AppShell>
  );
}
