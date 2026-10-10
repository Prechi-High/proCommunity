import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import type { UnmaskTab } from '@/lib/unmask/types';

const LABELS: Record<UnmaskTab, string> = {
  overview: 'Overview',
  specs: 'Specs',
  evidence: 'Evidence',
  videos: 'Videos',
  ask: 'Ask',
};

const ORDER: UnmaskTab[] = ['overview', 'specs', 'evidence', 'videos', 'ask'];

export function ProductSubTabs({ value, onChange }: { value: UnmaskTab; onChange: (t: UnmaskTab) => void }) {
  return (
    <View style={{ backgroundColor: colors.headerBg, paddingBottom: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
        {ORDER.map((id) => {
          const active = value === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                hapticSelect();
                onChange(id);
              }}
              style={{ paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text
                style={{
                  fontFamily: active ? fonts.semibold : fonts.medium,
                  fontSize: 15,
                  color: active ? colors.gold : 'rgba(255,255,255,0.72)',
                }}
              >
                {LABELS[id]}
              </Text>
              {active ? (
                <View style={{ marginTop: 6, height: 3, width: '100%', minWidth: 32, borderRadius: 2, backgroundColor: colors.gold }} />
              ) : (
                <View style={{ marginTop: 6, height: 3 }} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
