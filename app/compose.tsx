import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Chip, Heading } from '@/components/ui';
import { BackButton } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticHeavy, hapticSelect, hapticSuccess } from '@/lib/haptics';
import { getAllProducts } from '@/lib/catalog';
import { expertById } from '@/lib/communitySample';
import { useAppStore } from '@/lib/store';

const KINDS: { id: string; label: string }[] = [
  { id: 'fear', label: 'My fear' },
  { id: 'why', label: 'Why I want it' },
  { id: 'question', label: 'A question' },
  { id: 'trace', label: 'Leave a Trace' },
];

const PH: Record<string, string> = {
  fear: 'What worries you about this product? For example breakouts, price, or whether it will suit your skin.',
  why: 'What made you want it? What are you hoping it will help with?',
  question: 'What do you want to know?',
  trace: 'What surprised you? What do you wish you knew before buying? Anything the next person should know?',
};

/**
 * Compose sheet from sourced-v1 (2).html — fear / why / question / Trace.
 */
export default function ComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; expert?: string; product?: string }>();
  const products = useMemo(() => getAllProducts().slice(0, 8), []);
  const profile = useAppStore((s) => s.profile);
  const addPost = useAppStore((s) => s.addPost);
  const addThread = useAppStore((s) => s.addThread);
  const ownerships = useAppStore((s) => s.ownerships);
  const [kind, setKind] = useState(params.kind ?? 'fear');
  const [productId, setProductId] = useState(params.product ?? products[0]?.id ?? '');
  const [text, setText] = useState('');
  const [shake, setShake] = useState(false);

  const expert = params.expert ? expertById(params.expert) : null;
  const showTrace = kind === 'trace' || ownerships.length > 0;
  const kinds = KINDS.filter((k) => k.id !== 'trace' || showTrace);

  const title = expert
    ? `Ask ${expert.name}`
    : kind === 'trace'
      ? 'Leave a Trace'
      : 'Share with the community';
  const hint = expert
    ? `Your question goes to ${expert.name} and the community. Experts give general information, not medical advice.`
    : kind === 'trace'
      ? 'You’ve used it. What should the next person know?'
      : 'Verified owners and experts will see this. We’ll tell you when someone replies.';

  const post = () => {
    const body = text.trim();
    if (body.length < 8) {
      setShake(true);
      hapticHeavy();
      setTimeout(() => setShake(false), 400);
      return;
    }
    if (!profile) {
      router.push('/(auth)/sign-in');
      return;
    }
    const threadId = addThread(productId, body.length > 58 ? `${body.slice(0, 56).trim()}…` : body);
    addPost({
      productId,
      threadId,
      body,
      type: kind === 'trace' || kind === 'why' ? 'experience' : 'question',
      traitTags: [],
      isVerifiedOwner: ownerships.some((o) => o.productId === productId),
      userId: profile.id,
      authorName: profile.displayName,
    });
    hapticSuccess();
    router.replace(`/product/${productId}/thread/${threadId}` as Href);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <BackButton />
        <Caption>Community</Caption>
      </View>
      <Heading size={25} style={{ marginTop: 12 }}>
        {title}
      </Heading>
      <Caption>{hint}</Caption>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {kinds.map((k) => (
          <Chip
            key={k.id}
            label={k.label}
            selected={kind === k.id}
            onPress={() => {
              setKind(k.id);
              hapticSelect();
            }}
          />
        ))}
      </View>

      <Caption>About</Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {products.map((p) => (
          <Chip
            key={p.id}
            label={p.name.slice(0, 22)}
            selected={productId === p.id}
            onPress={() => {
              setProductId(p.id);
              hapticSelect();
            }}
          />
        ))}
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={PH[kind] ?? PH.question}
        placeholderTextColor={colors.bone3}
        multiline
        style={{
          marginTop: 16,
          minHeight: 140,
          borderRadius: radii.card,
          backgroundColor: colors.lac,
          padding: 16,
          fontFamily: fonts.regular,
          fontSize: 16,
          color: colors.bone,
          textAlignVertical: 'top',
          borderWidth: shake ? 1.5 : 0,
          borderColor: colors.coral,
        }}
      />
      <Button label="Post" style={{ marginTop: 14 }} onPress={post} />
      <Caption>
        Be kind and specific. Posts that give medical advice or attack people are removed. Honest criticism of
        a product never is.
      </Caption>
    </Screen>
  );
}
