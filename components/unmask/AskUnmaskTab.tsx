import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ChatTeardropText, MagnifyingGlass, PaperPlaneRight, PencilSimple } from '@/components/icons';
import { PrimaryButton, Tile } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { investigateQuestion } from '@/lib/unmask/askMatch';
import type { AskResult, UnmaskBundle } from '@/lib/unmask/types';
import type { ProductProfile } from '@/lib/types';

import { SectionTitle, toneColors } from './shared';

type Props = {
  profile: ProductProfile;
  bundle: UnmaskBundle;
  onAskCommunity: (question: string) => void;
};

export function AskUnmaskTab({ profile, bundle, onAskCommunity }: Props) {
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);

  const submit = () => {
    const q = draft.trim();
    if (!q) return;
    setResult(investigateQuestion(profile, q));
  };

  if (result?.kind === 'answer') {
    const a = result.answer;
    return (
      <View style={{ gap: 20 }}>
        <QuestionChip text={a.question} />
        <SectionTitle title="Unmask answer" />
        <Tile style={{ gap: 8, borderColor: colors.line, borderWidth: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hiInk }}>Short answer</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}>{a.shortAnswer}</Text>
        </Tile>
        {a.buckets.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>Evidence summary</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {a.buckets.map((b) => {
                const tone = toneColors(b.tone === 'positive' ? 'positive' : b.tone === 'negative' ? 'negative' : 'mixed');
                return (
                  <View key={b.label} style={{ flex: 1, minWidth: '30%', borderRadius: 12, backgroundColor: tone.bg, padding: 10, gap: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: tone.fg }}>{b.pct}%</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone2 }}>{b.label}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{b.count} reports</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
        {a.findings.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>Key findings</Text>
            {a.findings.map((f, i) => (
              <Text key={i} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>• {f}</Text>
            ))}
          </View>
        ) : null}
        {a.evidence.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>Supporting evidence</Text>
            {a.evidence.map((e, i) => (
              <Tile key={i} style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone }}>{e.summary}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>{e.origin}</Text>
              </Tile>
            ))}
          </View>
        ) : null}
        <Pressable onPress={() => { setResult(null); setDraft(''); }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi, textAlign: 'center' }}>Ask another question</Text>
        </Pressable>
      </View>
    );
  }

  if (result?.kind === 'insufficient') {
    return (
      <View style={{ gap: 20, alignItems: 'center' }}>
        <QuestionChip text={draft} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, textAlign: 'center', color: colors.bone, letterSpacing: -0.4 }}>
          We couldn&apos;t find enough evidence to answer this confidently yet.
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2, textAlign: 'center' }}>{result.hint}</Text>
        <Tile style={{ backgroundColor: colors.honeySoft, gap: 8 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.honeyInk }}>
            Community responses help fill gaps. Real owners can share what we haven&apos;t indexed yet.
          </Text>
        </Tile>
        <PrimaryButton label="Ask owners" icon={ChatTeardropText} tone="ink" onPress={() => onAskCommunity(draft)} />
        <Pressable onPress={() => setResult(null)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <PencilSimple size={16} color={colors.hi} weight="bold" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Rephrase my question</Text>
        </Pressable>
        <SuggestionList
          suggestions={result.suggestions}
          onPick={(q) => {
            setDraft(q);
            setResult(investigateQuestion(profile, q));
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MagnifyingGlass size={22} color={colors.hi} weight="bold" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.bone }}>Ask Unmask</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.hiSoft }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.hiInk }}>Beta</Text>
        </View>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Answers use indexed owner evidence on this product — not a generic chatbot.</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderRadius: radii.search,
          backgroundColor: colors.wineDeep,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <MagnifyingGlass size={18} color={colors.bone3} weight="bold" />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask anything about this product…"
          placeholderTextColor={colors.bone3}
          onSubmitEditing={submit}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.bone, minHeight: 44 }}
        />
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}
        >
          <PaperPlaneRight size={18} color={colors.white} weight="fill" />
        </Pressable>
      </View>
      <SuggestionList
        suggestions={bundle.suggestions}
        onPick={(q) => {
          setDraft(q);
          setResult(investigateQuestion(profile, q));
        }}
      />
    </View>
  );
}

function QuestionChip({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'stretch', borderRadius: radii.card, backgroundColor: colors.coralSoft, padding: 14 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.coral, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

function SuggestionList({
  suggestions,
  onPick,
}: {
  suggestions: { id: string; question: string }[];
  onPick: (q: string) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>Try asking about…</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {suggestions.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onPick(s.question)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.lac,
            }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone }}>{s.question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
