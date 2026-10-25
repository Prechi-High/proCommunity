import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { ActionButton, AppShell, StatusMessage } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import * as api from '@/lib/investigations/api';
import * as community from '@/lib/community-v2/api';
import * as living from '@/lib/living/api';
import { hapticSaved } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';

export default function RequestUnmask() {
  const p = useLocalSearchParams<{ product?: string; question?: string; experience?: string; q?: string }>();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [title, setTitle] = useState(p.q || '');
  const [concern, setConcern] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const products = useQuery({ queryKey: ['catalog'], queryFn: () => living.catalog() });
  const story = useQuery({
    queryKey: ['clarity-experience', p.experience],
    queryFn: () => community.experience(p.experience!),
    enabled: !!p.experience,
  });
  const product = products.data?.find((x) => x.id === p.product);
  const submit = async () => {
    if (!uid) {
      router.push('/(auth)/sign-in' as Href);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const out = await api.create({
        title: title.trim(),
        concern: concern.trim() || title.trim(),
        supporting_links: '',
        product_id: p.product || null,
        question_id: p.question || null,
        experience_id: p.experience || null,
      });
      hapticSaved(out.id);
      router.replace(`/investigation/${out.id}` as Href);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Unable to open this Unmask.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell back title={COPY.requestUnmask} subtitle={COPY.requestPrompt}>
      {product ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{product.name}</Text>
      ) : null}
      {story.data ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>
          Linked story: {story.data.body.slice(0, 140)}
        </Text>
      ) : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>What do you need to know — and why?</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        multiline
        placeholder="Why did this happen? Will it keep working? What should I have known?"
        placeholderTextColor={colors.bone3}
        style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, minHeight: 80, color: colors.ink }}
      />
      <TextInput
        value={concern}
        onChangeText={setConcern}
        multiline
        placeholder="Any extra context (optional)"
        placeholderTextColor={colors.bone3}
        style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, minHeight: 72, color: colors.ink }}
      />
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
        Your question opens for community support. The team reviews its scope and assigns an Unmask Creator. Support does not guarantee a company response or a particular conclusion. Choosing a creator is coming later.
      </Text>
      {error ? <StatusMessage kind="error" title="Request didn’t open." detail={error} /> : null}
      <ActionButton
        label="Start an Ultra Unmask"
        pending={busy}
        disabled={title.trim().length < 10}
        explanation={title.trim().length < 10 ? 'Write a slightly fuller question.' : undefined}
        onPress={() => void submit()}
      />
    </AppShell>
  );
}
