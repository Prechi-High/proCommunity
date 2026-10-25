import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ActionButton, AppShell, StatusMessage } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import * as living from '@/lib/living/api';
import { getKnownProduct } from '@/lib/products';
import { hapticSaved } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';

export default function AskAboutProduct() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const product = getKnownProduct(id);
  const [body, setBody] = useState(q || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = useQuery({ queryKey: ['product-questions', id], queryFn: () => living.questions(id) });

  const post = async () => {
    if (!uid) {
      router.push('/(auth)/sign-in' as Href);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (product) await living.registerProduct(product);
      const out = await living.addQuestion({ product_id: id, body: body.trim() });
      hapticSaved(out.id);
      await qc.invalidateQueries({ queryKey: ['product-questions', id] });
      router.replace(`/question/${out.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to post. Your question is still here.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell back title={COPY.questionPrompt} subtitle={product?.name || 'This product'}>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Has anyone used this…?"
        placeholderTextColor={colors.bone3}
        style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, minHeight: 100, color: colors.ink }}
      />
      {error ? <StatusMessage kind="error" title="Question didn’t post." detail={error} /> : null}
      <ActionButton
        label="Ask the community"
        pending={busy}
        disabled={!body.trim()}
        onPress={() => void post()}
      />
      {(existing.data ?? []).slice(0, 6).map((item) => (
        <Text
          key={item.id}
          onPress={() => router.push(`/question/${item.id}` as Href)}
          style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.brandDeep }}
        >
          {item.body}
        </Text>
      ))}
    </AppShell>
  );
}
