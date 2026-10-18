import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import type { PresentationNavItem } from '@/lib/unmask/presentation';
import type { UnmaskTab } from '@/lib/unmask/types';

const FALLBACK: PresentationNavItem[] = [
  { key: 'overview', label: 'Overview', renderer: 'overview' },
  { key: 'specs', label: 'Specs', renderer: 'fact_groups' },
  { key: 'evidence', label: 'Evidence', renderer: 'evidence' },
  { key: 'videos', label: 'Videos', renderer: 'video_evidence' },
  { key: 'ask', label: 'Ask', renderer: 'ask' },
];

export function ProductSubTabs({
  value,
  onChange,
  navigation,
}: {
  value: UnmaskTab;
  onChange: (t: UnmaskTab) => void;
  navigation?: PresentationNavItem[] | null;
}) {
  const items = navigation?.length ? navigation : FALLBACK;

  return (
    <View style={{ backgroundColor: colors.headerBg, paddingBottom: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
        {items.map((item) => {
          const active = value === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                hapticSelect();
                onChange(item.key as UnmaskTab);
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
                {item.label}
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
