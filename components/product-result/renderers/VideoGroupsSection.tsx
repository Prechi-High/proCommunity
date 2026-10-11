import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { VideosPane } from '@/components/product/VideosPane';
import { colors, fonts } from '@/constants/theme';
import type { ProductSectionUI } from '@/lib/product-result/contract';
import type { Product } from '@/lib/types';
import type { JourneyClip } from '@/lib/videos';

type Group = { key: string; label: string; filter_key?: string; topic_tags?: string[] };

export function VideoGroupsSection({
  section,
  product,
  clips,
  loading,
}: {
  section: ProductSectionUI;
  product: Product;
  clips: JourneyClip[];
  loading: boolean;
}) {
  const groups = ((section.data as { groups?: Group[] })?.groups ?? []).filter((g) => g.label);
  const [active, setActive] = useState<string>(groups[0]?.key ?? 'all');

  const filtered = useMemo(() => {
    if (!groups.length || active === 'all') return clips;
    const g = groups.find((x) => x.key === active);
    if (!g) return clips;
    const terms = [
      g.label,
      g.key.replace(/_/g, ' '),
      ...(g.filter_key ? [g.filter_key.replace(/_/g, ' ')] : []),
      ...(g.topic_tags ?? []),
    ].map((t) => t.toLowerCase());
    return clips.filter((c) => {
      const hay = `${c.title ?? ''} ${c.author ?? ''} ${(c.contentTags ?? []).join(' ')}`.toLowerCase();
      return terms.some((t) => t.length > 2 && hay.includes(t));
    });
  }, [clips, groups, active]);

  if (!groups.length) {
    return (
      <VideosPane
        product={{ id: product.id, name: product.name, brand: product.brand, category: product.category }}
        clips={clips}
        loading={loading}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>{section.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {groups.map((g) => {
          const on = g.key === active;
          return (
            <Pressable
              key={g.key}
              onPress={() => setActive(g.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: on ? colors.black : colors.lac,
                borderWidth: on ? 0 : 1,
                borderColor: colors.line,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? colors.white : colors.bone }}>{g.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <VideosPane
        product={{ id: product.id, name: product.name, brand: product.brand, category: product.category }}
        clips={filtered}
        loading={loading}
      />
    </View>
  );
}
