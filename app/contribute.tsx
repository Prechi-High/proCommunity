import { getKnownProduct } from '@/lib/products';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ActionButton,
  AppShell,
  EmptyState,
  FilterChips,
  FocusCorners,
  MediaFrame,
  SearchField,
  StatusMessage,
} from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import * as api from '@/lib/clarity/api';
import * as community from '@/lib/community-v2/api';
import * as living from '@/lib/living/api';
import { hapticSaved } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';

export default function Contribute() {
  const router = useRouter();
  const qc = useQueryClient();
  const p = useLocalSearchParams<{ product?: string; experience?: string; mine?: string; update?: string }>();
  const uid = useAppStore((s) => s.profile?.id);
  const [step, setStep] = useState(p.product || p.experience ? 'write' : p.mine ? 'mine' : 'choose');
  const [product, setProduct] = useState(p.product || '');
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [duration, setDuration] = useState('');
  const [skin, setSkin] = useState('Not disclosed');
  const [photo, setPhoto] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('public');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const cat = useQuery({ queryKey: ['catalog'], queryFn: () => living.catalog() });
  const own = useQuery({
    queryKey: ['my-clarity-experiences'],
    queryFn: () => api.experiences(true),
    enabled: !!uid && step === 'mine',
  });
  const exact = useQuery({ queryKey: ['catalog', product], queryFn: () => living.catalog(product), enabled: !!product });
  const known = getKnownProduct(product);
  const selected = cat.data?.find(x => x.id === product) || exact.data?.[0] || (known ? { id: known.id, name: known.name, brand: known.brand, category: known.category, image_url: known.heroImageUrl } : undefined);
  const key = `unmask:experience-draft:${uid || 'guest'}:${p.experience || product || 'new'}`;

  useEffect(() => {
    void AsyncStorage.getItem(key).then((raw) => {
      if (!raw) return;
      const d = JSON.parse(raw);
      setBody(d.body || '');
      setDuration(d.duration || '');
      setSkin(d.skin || 'Not disclosed');
    });
  }, [key]);
  useEffect(() => {
    if (!body && !duration) return;
    void AsyncStorage.setItem(key, JSON.stringify({ body, duration, skin }));
  }, [body, duration, skin, key]);

  const save = async () => {
    if (!uid) {
      router.push('/(auth)/sign-in' as Href);
      return;
    }
    if (!selected) {
      setError('Confirm the product first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const photoPath = photo ? await community.uploadPhoto(photo) : null;
      await living.registerProduct({
        id: selected.id,
        name: selected.name,
        brand: selected.brand || '',
        category: selected.category || '',
        heroImageUrl: selected.image_url,
      });
      const saved = await api.saveExperience({
        photo_path: photoPath,
        product_id: product,
        duration,
        frequency: 'Not stated',
        goal: '',
        body: body.trim(),
        outcome: 'Mixed',
        uncertainty: '',
        context: '',
        skin_type: skin === 'Not disclosed' ? null : skin,
        acquisition: 'Prefer not to say',
        usage_status: 'Still using',
        would_rebuy: 'Not stated',
        visibility,
      });
      await AsyncStorage.removeItem(key);
      await qc.invalidateQueries();
      hapticSaved(saved.id);
      setDone(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your draft is still here. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AppShell back title="Your story is live.">
        <StatusMessage kind="success" title={COPY.storyLive} detail="Others can reply. If you need why, demand an Ultra Unmask." />
        <ActionButton label="View story" onPress={() => router.replace(`/story/${done}` as Href)} />
        <ActionButton
          tone="secondary"
          label={COPY.takeFurther}
          onPress={() => router.replace(`/investigation/request?experience=${done}&product=${product}` as Href)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell back title={p.update ? COPY.followUpPrompt : COPY.homePrompt} subtitle="Good or bad. Start with what happened. Keep updating it.">
      {step === 'mine' ? (
        <>
          {(own.data ?? []).map((e) => (
            <Pressable key={e.id} onPress={() => router.push(`/story/${e.id}` as Href)}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{e.body.slice(0, 90)}</Text>
            </Pressable>
          ))}
          {!own.data?.length ? <EmptyState title="No stories yet." action={COPY.createExperience} onAction={() => setStep('choose')} /> : null}
        </>
      ) : null}

      {step === 'choose' ? (
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Find the product" />
          {(cat.data ?? [])
            .filter((x) => `${x.name} ${x.brand}`.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 12)
            .map((x) => (
              <Pressable
                key={x.id}
                onPress={() => {
                  setProduct(x.id);
                  setStep('write');
                }}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 64 }}
              >
                <View style={{ width: 56, position: 'relative' }}>
                  <MediaFrame uri={x.image_url} label={x.name} ratio={1} />
                  {product === x.id ? <FocusCorners selected /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{x.name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>{x.brand}</Text>
                </View>
              </Pressable>
            ))}
          <ActionButton tone="ghost" label={COPY.noMatch} onPress={() => router.push('/results' as Href)} />
        </>
      ) : null}

      {step === 'write' ? (
        <>
          {selected ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>
              {selected.name}
              <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}> · confirmed</Text>
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>What happened?</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder={COPY.contributePlaceholder}
            placeholderTextColor={colors.bone3}
            style={{
              minHeight: 140,
              fontFamily: fonts.regular,
              fontSize: 16,
              lineHeight: 24,
              color: colors.ink,
              textAlignVertical: 'top',
            }}
          />
          <Pressable onPress={() => setMore((v) => !v)}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brandDeep }}>
              {more ? 'Hide optional details' : 'Add how long you used it and more context'}
            </Text>
          </Pressable>
          {more ? (
            <View style={{ gap: 12 }}>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                placeholder="How long have you used it? e.g. 6 weeks"
                placeholderTextColor={colors.bone3}
                style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.ink, minHeight: 44 }}
              />
              <FilterChips
                variant="chips"
                options={['Not disclosed', 'Dry', 'Oily', 'Combination', 'Sensitive', 'I’m not sure']}
                value={skin}
                onChange={setSkin}
              />
            </View>
          ) : null}
          <ActionButton
            tone="ghost"
            label={photo ? 'Change photo' : 'Add a photo (optional)'}
            onPress={() =>
              void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }).then((out) => {
                if (!out.canceled) setPhoto(out.assets[0]?.uri || '');
              })
            }
          />
          {photo ? <MediaFrame uri={photo} label="Selected photo" /> : null}
          <FilterChips
            options={['public', 'private']}
            value={visibility}
            onChange={(v) => setVisibility(v === 'public' ? 'public' : 'private')}
          />
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
            {visibility === 'public' ? COPY.publicPreview : 'Only you can see this until you share it.'}
          </Text>
          {error ? <StatusMessage kind="error" title="Couldn’t post yet." detail={error} /> : null}
          <ActionButton
            label={busy ? 'Posting' : 'Post story'}
            pending={busy}
            disabled={!body.trim()}
            explanation={!body.trim() ? 'Write what happened first.' : undefined}
            onPress={() => void save()}
          />
        </>
      ) : null}
    </AppShell>
  );
}
