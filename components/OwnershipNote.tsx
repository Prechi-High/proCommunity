import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Check, SealCheck, X } from '@/components/icons';
import { PrimaryButton, ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { createOwnershipNote } from '@/lib/owners';
import { useAppStore } from '@/lib/store';
import type { OwnershipMilestone, Product } from '@/lib/types';

type Draft = {
  milestone: OwnershipMilestone;
  title: string;
  body: string;
  usedFor: string;
  usedDuration: string;
  timesBought: string;
  rating: number | null;
  wouldRebuy: boolean | null;
  timeToProblem: string;
  timeToResults: string;
  positiveTags: string[];
  issueTags: string[];
  contextTags: string[];
};

const MILESTONES: { id: OwnershipMilestone; label: string }[] = [
  { id: 'first_note', label: 'First note' },
  { id: 'one_month', label: 'After 1 month' },
  { id: 'six_months', label: 'After 6 months' },
  { id: 'after_problem', label: 'After a problem' },
  { id: 'update', label: 'Update' },
];

const BASE_GOOD = ['Easy to use', 'Worth the money', 'Still works well', 'I bought again'];
const BASE_ISSUES = ['Overheating', 'Breakage', 'Battery drain', 'Poor quality'];

function prompts(category: string) {
  const c = category.toLowerCase();
  if (/skin|beaut|cream|cosmetic|hair|makeup|serum|soap/.test(c)) {
    return {
      good: ['Visible changes', 'Gentle on skin', 'Good fragrance', 'Works fast'],
      issues: ['Breakouts', 'Irritation', 'Strong fragrance', 'No visible change'],
      context: ['Oily skin', 'Dry skin', 'Sensitive skin', 'Daily use'],
      usedFor: 'e.g. dark spots, dry skin, acne, glow',
      timeToResults: 'e.g. 2 weeks before I saw changes',
      timeToProblem: 'e.g. irritation started after 3 days',
    };
  }
  if (/laptop|computer|phone|tablet|earbud|headphone|speaker|watch|electronics?/.test(c)) {
    return {
      good: ['Fast performance', 'Good battery', 'Reliable', 'Great display'],
      issues: ['Overheating', 'Battery drain', 'Charging issue', 'Lag'],
      context: ['Coding', 'Gaming', 'School', 'Work calls'],
      usedFor: 'e.g. coding, gaming, school, video calls',
      timeToResults: 'e.g. felt fast from day one',
      timeToProblem: 'e.g. battery got weak after 8 months',
    };
  }
  if (/shoe|cloth|shirt|bag|fashion|sneaker/.test(c)) {
    return {
      good: ['Comfortable', 'True to size', 'Looks premium', 'Durable'],
      issues: ['Pilling', 'Sole wear', 'Loose stitching', 'Runs small'],
      context: ['Daily wear', 'Work', 'Long walks', 'Gym'],
      usedFor: 'e.g. office, running, daily wear',
      timeToResults: 'e.g. comfortable after one wear',
      timeToProblem: 'e.g. pilling started after 4 washes',
    };
  }
  return {
    good: BASE_GOOD,
    issues: BASE_ISSUES,
    context: ['Daily use', 'Travel', 'Work', 'Family use'],
    usedFor: 'e.g. what you mainly use it for',
    timeToResults: 'e.g. when you noticed the benefit',
    timeToProblem: 'e.g. when something started going wrong',
  };
}

function emptyDraft(category: string): Draft {
  const p = prompts(category);
  return {
    milestone: 'first_note',
    title: '',
    body: '',
    usedFor: '',
    usedDuration: '',
    timesBought: '',
    rating: null,
    wouldRebuy: null,
    timeToProblem: '',
    timeToResults: '',
    positiveTags: [],
    issueTags: [],
    contextTags: p.context.slice(0, 1),
  };
}

/** Modal hook for the "Ownership Note" ritual: verified owners share structured real-use context. */
export function useOwnershipNote() {
  const [product, setProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(''));
  const qc = useQueryClient();
  const memberId = useAppStore((s) => s.profile?.id);

  const note = useMutation({
    mutationFn: () =>
      createOwnershipNote({
        product: product!,
        milestone: draft.milestone,
        title: draft.title.trim(),
        body: draft.body.trim(),
        usedFor: draft.usedFor.trim(),
        usedDuration: draft.usedDuration.trim(),
        timesBought: draft.timesBought.trim() ? Number(draft.timesBought) : null,
        rating: draft.rating,
        wouldRebuy: draft.wouldRebuy,
        timeToProblem: draft.timeToProblem.trim(),
        timeToResults: draft.timeToResults.trim(),
        positiveTags: draft.positiveTags,
        issueTags: draft.issueTags,
        contextTags: draft.contextTags,
      }),
    onSuccess: () => {
      hapticSuccess();
      void qc.invalidateQueries({ queryKey: ['member', memberId] });
      void qc.invalidateQueries({ queryKey: ['room', product?.id] });
      setProduct(null);
    },
  });

  const start = (p: Product) => {
    setProduct(p);
    setDraft(emptyDraft(p.category ?? ''));
    note.reset();
  };

  const sheet = product ? (
    <Modal visible transparent animationType="slide" onRequestClose={() => setProduct(null)}>
      <Pressable onPress={() => !note.isPending && setProduct(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.wine, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%', paddingTop: 18 }}>
          <OwnershipNoteForm
            product={product}
            draft={draft}
            setDraft={setDraft}
            saving={note.isPending}
            error={note.isError}
            onClose={() => setProduct(null)}
            onSubmit={() => note.mutate()}
          />
        </Pressable>
      </Pressable>
    </Modal>
  ) : null;

  return { start, sheet };
}

function OwnershipNoteForm({
  product,
  draft,
  setDraft,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  product: Product;
  draft: Draft;
  setDraft: (d: Draft | ((d: Draft) => Draft)) => void;
  saving: boolean;
  error: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const p = prompts(product.category ?? '');
  const canSubmit = draft.title.trim().length >= 4 && draft.body.trim().length >= 8 && !saving;
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
        <ProductImage uri={product.heroImageUrl ?? null} category={product.category} size={48} radius={14} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.bone3 }}>Add an Ownership Note</Text>
          <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{product.name}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <X size={20} color={colors.bone2} weight="bold" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: colors.hiSoft, borderRadius: 18, padding: 14, gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3, color: colors.hiInk }}>Tell it like you’d tell a friend</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.hiInk, opacity: 0.82 }}>
            This goes on your verified shelf and helps Unmask answer future questions with real owner experience.
          </Text>
        </View>

        <ChipGroup
          label="When is this note from?"
          values={MILESTONES}
          selected={[draft.milestone]}
          onToggle={(id) => setDraft((d) => ({ ...d, milestone: id as OwnershipMilestone }))}
          single
        />

        <Field label="Title" value={draft.title} onChangeText={(title) => setDraft((d) => ({ ...d, title }))} placeholder="e.g. Good for coding, but battery gets warm" maxLength={160} />
        <Field label="What did you use it for?" value={draft.usedFor} onChangeText={(usedFor) => setDraft((d) => ({ ...d, usedFor }))} placeholder={p.usedFor} maxLength={200} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="How long?" value={draft.usedDuration} onChangeText={(usedDuration) => setDraft((d) => ({ ...d, usedDuration }))} placeholder="e.g. 6 months" maxLength={80} compact />
          <Field label="Times bought/used" value={draft.timesBought} onChangeText={(timesBought) => setDraft((d) => ({ ...d, timesBought: timesBought.replace(/[^0-9]/g, '').slice(0, 3) }))} placeholder="e.g. 2" maxLength={3} compact />
        </View>

        <ChipGroup label="Good signs" values={p.good.map((x) => ({ id: x, label: x }))} selected={draft.positiveTags} onToggle={(tag) => setDraft((d) => toggleTag(d, 'positiveTags', tag))} />
        <ChipGroup label="Problems or warnings" values={p.issues.map((x) => ({ id: x, label: x }))} selected={draft.issueTags} onToggle={(tag) => setDraft((d) => toggleTag(d, 'issueTags', tag))} tone="warn" />
        <ChipGroup label="Context" values={p.context.map((x) => ({ id: x, label: x }))} selected={draft.contextTags} onToggle={(tag) => setDraft((d) => toggleTag(d, 'contextTags', tag))} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="If there was a problem" value={draft.timeToProblem} onChangeText={(timeToProblem) => setDraft((d) => ({ ...d, timeToProblem }))} placeholder={p.timeToProblem} maxLength={80} compact />
          <Field label="If there was a result" value={draft.timeToResults} onChangeText={(timeToResults) => setDraft((d) => ({ ...d, timeToResults }))} placeholder={p.timeToResults} maxLength={80} compact />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.bone }}>Your honest note</Text>
          <TextInput
            value={draft.body}
            onChangeText={(body) => setDraft((d) => ({ ...d, body }))}
            placeholder="What surprised you? What should a buyer know before spending money?"
            placeholderTextColor={colors.bone3}
            multiline
            maxLength={2400}
            style={{ minHeight: 116, backgroundColor: colors.lac, borderRadius: 16, padding: 14, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.bone, outlineStyle: 'none' } as never}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[1, 2, 3, 4, 5].map((r) => (
            <Pressable key={r} onPress={() => setDraft((d) => ({ ...d, rating: d.rating === r ? null : r }))} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: draft.rating === r ? colors.hi : colors.lac, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: draft.rating === r ? colors.white : colors.bone }}>{r}</Text>
            </Pressable>
          ))}
        </View>

        <ChipGroup
          label="Would you buy it again?"
          values={[
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
            { id: 'maybe', label: 'Maybe' },
          ]}
          selected={[draft.wouldRebuy === true ? 'yes' : draft.wouldRebuy === false ? 'no' : 'maybe']}
          onToggle={(id) => setDraft((d) => ({ ...d, wouldRebuy: id === 'maybe' ? null : id === 'yes' }))}
          single
        />

        {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.coral }}>That note didn’t save. Make sure you’re verified for this product and try again.</Text> : null}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.lac, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
        <PrimaryButton label={saving ? 'Saving…' : 'Publish Ownership Note'} icon={saving ? undefined : SealCheck} onPress={canSubmit ? onSubmit : () => undefined} />
      </View>
    </>
  );
}

function toggleTag(d: Draft, key: 'positiveTags' | 'issueTags' | 'contextTags', tag: string): Draft {
  const current = d[key];
  return { ...d, [key]: current.includes(tag) ? current.filter((x) => x !== tag) : current.length >= 6 ? current : [...current, tag] };
}

function Field({ label, value, onChangeText, placeholder, maxLength, compact }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; maxLength: number; compact?: boolean }) {
  return (
    <View style={{ flex: compact ? 1 : undefined, gap: 7 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.bone }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.bone3}
        maxLength={maxLength}
        style={{ height: 46, backgroundColor: colors.lac, borderRadius: 14, paddingHorizontal: 13, fontFamily: fonts.regular, fontSize: 14, color: colors.bone, outlineStyle: 'none' } as never}
      />
    </View>
  );
}

function ChipGroup({
  label,
  values,
  selected,
  onToggle,
  single,
  tone,
}: {
  label: string;
  values: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
  tone?: 'warn';
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.bone }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {values.map((v) => {
          const on = selected.includes(v.id);
          const bg = on ? (tone === 'warn' ? colors.honeySoft : colors.hiSoft) : colors.lac;
          const ink = on ? (tone === 'warn' ? colors.honeyInk : colors.hiInk) : colors.bone2;
          return (
            <Pressable
              key={v.id}
              onPress={() => {
                hapticSelect();
                onToggle(v.id);
              }}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={{ selected: on, checked: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: bg }}
            >
              {on ? <Check size={12} color={ink} weight="bold" /> : null}
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: ink }}>{v.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
