import { ExperienceAttachment, AttachedExperienceLink } from '@/components/unmask-ui/ExperienceAttachment';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ActionButton, AppShell, Avatar, StatusMessage } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import * as api from '@/lib/living/api';
import { hapticSaved } from '@/lib/haptics';
import { SAMPLE_REPLIES, sampleById } from '@/lib/unmask/samples';
import { useAppStore } from '@/lib/store';

export default function QuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const sample = sampleById(id);
  const q = useQuery({ queryKey: ['question', id], queryFn: () => api.question(id), enabled: !!id && !sample });
  const answers = useQuery({ queryKey: ['answers', id], queryFn: () => api.answers(id), enabled: !!id && !sample });
  const [attachment, setAttachment] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!uid) {
      router.push('/(auth)/sign-in' as Href);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.addAnswer({
        question_id: id,
        attached_experience_id: attachment || null,
        duration: '',
        context: '',
        acquisition: 'not_stated',
        body: body.trim(),
        uncertainty: '',
      });
      hapticSaved(id);
      setBody(''); setAttachment('');
      await qc.invalidateQueries({ queryKey: ['answers', id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reply didn’t send. Your text is still here.');
    } finally {
      setBusy(false);
    }
  };

  if (sample) {
    const thread = SAMPLE_REPLIES[sample.id] ?? [];
    return (
      <AppShell back title="Question" subtitle={`Asked by ${sample.author}`}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
          Design sample · not a live member question.
        </Text>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.4 }}>
          {sample.title}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>{sample.body}</Text>
        {thread.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
            <Avatar name={a.author} uri={a.avatar} size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{a.author}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{a.body}</Text>

            </View>
          </View>
        ))}
        <ActionButton label="Sign in to answer" onPress={() => router.push('/(auth)/sign-in' as Href)} />
      </AppShell>
    );
  }

  return (
    <AppShell back title="Question" subtitle={q.data?.author_name ? `Asked by ${q.data.author_name}` : undefined}>
      {q.isError ? <StatusMessage kind="error" title="This question isn’t available." /> : null}
      {q.data ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: colors.ink }}>{q.data.body}</Text>
      ) : null}
      {(answers.data ?? []).map((a) => (
        <View key={a.id} style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{a.author_name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{a.body}</Text>
          <AttachedExperienceLink id={a.attached_experience_id} />
        </View>
      ))}
      <ExperienceAttachment productId={q.data?.product_id} value={attachment} onChange={setAttachment} />
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Answer with what you lived. How you used it matters."
        placeholderTextColor={colors.bone3}
        style={{ fontFamily: fonts.regular, fontSize: 16, minHeight: 80, color: colors.ink }}
      />
      {error ? <StatusMessage kind="error" title="Reply didn’t send." detail={error} /> : null}
      <ActionButton label={COPY.answerCta} pending={busy} disabled={!body.trim()} onPress={() => void send()} />
      {q.data?.product_id ? (
        <ActionButton
          tone="ghost"
          label={COPY.takeFurther}
          onPress={() =>
            router.push(`/investigation/request?question=${id}&product=${q.data?.product_id}` as Href)
          }
        />
      ) : null}
    </AppShell>
  );
}
