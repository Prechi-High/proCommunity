import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Files, MagnifyingGlass } from '@/components/icons';
import { Shimmer } from '@/components/kit';
import { CardRow, TopBar } from '@/components/research';
import { colors, fonts } from '@/constants/theme';
import { research } from '@/lib/research';
import { useAppStore } from '@/lib/store';

export default function ResearchListScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const cards = useQuery({ queryKey: ['research', 'list', term], queryFn: () => research.list(term || undefined), enabled: Boolean(profile), staleTime: 15_000 });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <TopBar title="My Research" fallback="/you" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}>
        {!profile ? (
          <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 20, gap: 10, alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>Keep your research in one place</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>
              Sign in to save Research Cards, ask follow-up questions and share them.
            </Text>
            <Pressable onPress={() => router.push('/(auth)/sign-in')} style={{ height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: colors.hi, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.lac, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.line }}>
              <MagnifyingGlass size={17} color={colors.bone3} weight="bold" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search your research"
                placeholderTextColor={colors.bone3}
                style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.bone, outlineStyle: 'none' } as never}
              />
            </View>
            {cards.isLoading ? (
              [0, 1, 2, 3].map((i) => <Shimmer key={i} height={80} radius={18} />)
            ) : cards.isError ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.coral, textAlign: 'center', paddingTop: 30 }}>
                Couldn’t load your research. Pull to try again later.
              </Text>
            ) : cards.data?.length ? (
              cards.data.map((card) => <CardRow key={card.id} card={card} onPress={() => router.push({ pathname: '/research/[id]', params: { id: card.id } } as unknown as Href)} />)
            ) : (
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 20 }}>
                <Files size={36} color={colors.bone3} weight="regular" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone, textAlign: 'center' }}>{term ? 'No matches' : 'No Research Cards yet'}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2, textAlign: 'center' }}>
                  Open any product and tap “Save as Research Card”.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
