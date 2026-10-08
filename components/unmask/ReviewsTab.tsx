import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { VoiceCard } from '@/components/community';
import { Eyebrow } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import type { ProductProfile } from '@/lib/types';

type Props = {
  profile: ProductProfile;
};

export function ReviewsTab({ profile }: Props) {
  const voices = profile.voices ?? [];
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    voices.forEach((v) => {
      const t = v.topic || 'General';
      counts.set(t, (counts.get(t) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [voices]);
  const [filter, setFilter] = useState<string>('All');
  const filtered = filter === 'All' ? voices : voices.filter((v) => (v.topic || 'General') === filter);

  return (
    <View style={{ gap: 16 }}>
      <Eyebrow>Real owner experiences</Eyebrow>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>
        What verified and sourced owners said
      </Text>
      {topics.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['All', ...topics.map(([t]) => t)].map((t) => {
            const on = t === filter;
            return (
              <Pressable
                key={t}
                onPress={() => setFilter(t)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? colors.hi : colors.line,
                  backgroundColor: on ? colors.hiSoft : colors.lac,
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.hiInk : colors.bone }}>
                  {t}
                  {t !== 'All' ? ` (${topics.find(([x]) => x === t)?.[1] ?? 0})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={{ gap: 12 }}>
        {filtered.length ? filtered.map((v) => <VoiceCard key={v.id} voice={v} />) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
            No owner quotes indexed yet. Check back after research finishes or ask the community.
          </Text>
        )}
      </View>
    </View>
  );
}
