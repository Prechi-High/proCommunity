import { getKnownProduct } from '@/lib/products';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ActionButton,
  AppShell,
  FilterChips,
  FocusCorners,
  MediaFrame,
  SearchField,
  StatusMessage,
} from '@/components/unmask-ui';
import { colors, fonts } from '@/constants/theme';
import * as api from '@/lib/living/api';
import { hapticSaved } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { ProductState } from '@/lib/living/types';

export default function TrackProduct() {
  const { product } = useLocalSearchParams<{ product?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(product || '');
  const [status, setStatus] = useState('Currently using');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const q = useQuery({ queryKey: ['catalog'], queryFn: () => api.catalog() });
  const exact = useQuery({ queryKey: ['catalog', product], queryFn: () => api.catalog(product), enabled: !!product });
  const known = getKnownProduct(selected);
  const p = q.data?.find(x => x.id === selected) || exact.data?.find(x => x.id === selected) || (known ? { id: known.id, name: known.name, brand: known.brand, category: known.category, image_url: known.heroImageUrl } : undefined);

  const save = async () => {
    if (!p || !uid) {
      router.push('/(auth)/sign-in' as Href);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const state: ProductState =
        status === 'Currently using' ? 'active' : status === 'Paused use' ? 'paused' : status === 'Previously used' ? 'stopped' : 'purchased';
      await api.registerProduct({ id: p.id, name: p.name, brand: p.brand || '', category: p.category || 'skincare', heroImageUrl: p.image_url });
      await api.saveJourney({ product_id: p.id, acquisition: 'purchased', status: state, visibility: 'private' });
      hapticSaved(p.id);
      await qc.invalidateQueries({ queryKey: ['living', 'journeys'] });
      router.replace('/products' as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this product. Nothing was shared.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell back title="Track a product" subtitle="Private first. A name is enough to start.">
      {!uid ? (
        <StatusMessage kind="info" title="Sign in to keep a private timeline." />
      ) : null}
      <SearchField value={search} onChange={setSearch} placeholder="Find the product" />
      {!p
        ? (q.data ?? [])
            .filter((x) => `${x.name} ${x.brand}`.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 12)
            .map((x) => (
              <Pressable
                key={x.id}
                onPress={() => setSelected(x.id)}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
              >
                <View style={{ width: 56, position: 'relative' }}>
                  <MediaFrame uri={x.image_url} label={x.name} ratio={1} />
                  <FocusCorners selected={selected === x.id} />
                </View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{x.name}</Text>
              </Pressable>
            ))
        : (
          <View style={{ gap: 12 }}>
            <MediaFrame uri={p.image_url} label={p.name} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>{p.name}</Text>
            <FilterChips
              options={['Currently using', 'Paused use', 'Previously used', 'Not started']}
              value={status}
              onChange={setStatus}
            />
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
              Only you can see this until you share an experience.
            </Text>
            {error ? <StatusMessage kind="error" title="Not saved yet." detail={error} /> : null}
            <ActionButton label="Save privately" pending={busy} onPress={() => void save()} />
            <ActionButton tone="ghost" label="Choose another product" onPress={() => setSelected('')} />
          </View>
        )}
    </AppShell>
  );
}
