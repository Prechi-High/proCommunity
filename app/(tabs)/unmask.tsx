import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import {
  ActionButton,
  AppShell,
  ClarityLayers,
  CreatorStrip,
  EmptyState,
  FilterChips,
  SearchField,
  StatusMessage,
  StoryCard,
  StorySkeleton,
} from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { loadUnmasks } from '@/lib/unmask/feed';
import { previewUnmasks, SAMPLE_CREATORS } from '@/lib/unmask/samples';
import * as community from '@/lib/community-v2/api';

export default function Unmasks() {
  const router = useRouter();
  const [sort, setSort] = useState<'Recent' | 'Most sparked'>('Recent');
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: ['unmasks', sort],
    queryFn: () => loadUnmasks(sort),
  });
  const creators = useQuery({ queryKey: ['creators'], queryFn: community.creators });
  const rows = useMemo(() => {
    let out = previewUnmasks(list.data ?? [], sort);
    if (filter === 'Open')
      out = out.filter((i) => i.status === 'Open for Sparks' || i.chips.includes('Open for Sparks'));
    if (filter === 'Ultra')
      out = out.filter((i) => i.status === 'Ultra Unmasked' || i.cta.includes('Watch'));
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      out = out.filter((i) => `${i.title} ${i.productName}`.toLowerCase().includes(n));
    }
    return out;
  }, [filter, list.data, q, sort]);
  const creatorRows = (creators.data && creators.data.length ? creators.data : SAMPLE_CREATORS).slice(0, 8);
  const usingSamples = rows.some((i) => i.sample);

  return (
    <AppShell title="Unmask" serif notify flush subtitle={COPY.unmaskTabSubtitle}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Find an Ultra Unmask"
          onSubmit={() => {
            if (q.trim().length > 1) router.push({ pathname: '/results', params: { q: q.trim() } } as Href);
          }}
        />
        <FilterChips options={['All', 'Open', 'Ultra']} value={filter} onChange={setFilter} />
        <FilterChips
          options={['Recent', 'Most sparked']}
          value={sort}
          onChange={(v) => setSort(v as 'Recent' | 'Most sparked')}
        />
        {usingSamples && !list.isLoading ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>
            Preview community · labeled samples. Live Ultra Unmasks join this list when people demand why.
          </Text>
        ) : null}
        {filter === 'All' && !q ? <ClarityLayers /> : null}
      </View>
      {list.isError ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <StatusMessage kind="error" title="Couldn’t load Ultra Unmasks." detail="Try again in a moment." />
        </View>
      ) : null}
      {list.isLoading ? (
        <StorySkeleton />
      ) : rows.length ? (
        rows.map((item) => <StoryCard key={item.id} item={item} flush />)
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState
            title="Nothing in this view yet."
            detail="Share what happened. If you need why, start an Ultra Unmask and add Sparks."
            action={COPY.createQuestion}
            onAction={() => router.push('/ask-community' as Href)}
          />
        </View>
      )}
      <View style={{ paddingTop: 28, paddingBottom: 12, gap: 16 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            letterSpacing: 0.6,
            color: colors.inkSoft,
            paddingHorizontal: 20,
            textTransform: 'uppercase',
          }}
        >
          {COPY.unmaskersTitle}
        </Text>
        <CreatorStrip creators={creatorRows} />
        <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
            {COPY.unmaskersTeach}
          </Text>
          <ActionButton tone="ghost" label="See offers · unmask first" onPress={() => router.push('/offers' as Href)} />
        </View>
      </View>
    </AppShell>
  );
}
