import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Clock, Scan } from '@/components/icons';
import { Eyebrow, LargeTitle, ProductImage, SearchBar, Tile } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { displayName, getKnownProduct } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import { useScan } from '@/lib/useScan';

const TRY = ['AirPods Pro 2', 'Anker 20W charger', 'Nike Pegasus 41', 'Ninja blender', 'PS5 controller', 'Kindle Paperwhite'];

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const history = useAppStore((s) => s.searchHistory);
  const recentIds = useAppStore((s) => s.recentProductIds);
  useAppStore((s) => s.knownProducts);
  const addSearch = useAppStore((s) => s.addSearch);
  const scan = useScan();

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    addSearch(trimmed);
    router.push({ pathname: '/results', params: { q: trimmed } } as Href);
  };

  const recent = recentIds.map((id) => getKnownProduct(id)).filter(Boolean).slice(0, 8);
  const chips = history.length ? history.slice(0, 6).map((h) => h.query) : TRY;

  return (
    <Screen>
      <View style={{ paddingTop: 18, gap: 22 }}>
        <LargeTitle sub="Specs, real experiences, prices and videos — for any product.">Search anything.</LargeTitle>

        <SearchBar value={query} onChangeText={setQuery} onSubmit={() => go(query)} onScan={scan.start} busy={scan.busy} />

        <Tile tone="ink" onPress={scan.start} style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: colors.hi,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scan size={26} color={colors.white} weight="bold" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.white, letterSpacing: -0.3 }}>
                Point. Snap. Know.
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: 'rgba(255,255,255,0.66)', lineHeight: 18 }}>
                Photograph any product and get its full story in seconds.
              </Text>
            </View>
          </View>
        </Tile>

        <View style={{ gap: 10 }}>
          <Eyebrow>{history.length ? 'Recent searches' : 'Try'}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  hapticTap();
                  go(c);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.lac,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                {history.length ? <Clock size={13} color={colors.bone3} weight="bold" /> : null}
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {recent.length ? (
          <View style={{ gap: 10 }}>
            <Eyebrow>Recently viewed</Eyebrow>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
              {recent.map((p) => (
                <Pressable
                  key={p!.id}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: p!.id } } as Href)}
                  style={{ width: 116, gap: 8 }}
                >
                  <ProductImage uri={p!.heroImageUrl} category={p!.category} size={116} radius={18} />
                  <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone, lineHeight: 17 }}>
                    {displayName(p!)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <ScanOverlay visible={scan.busy} preview={scan.preview} />
    </Screen>
  );
}

function ScanOverlay({ visible, preview }: { visible: boolean; preview: string | null }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 26 }}>
        {preview ? (
          <Image source={{ uri: preview }} style={{ width: 220, height: 220, borderRadius: 28 }} resizeMode="cover" />
        ) : null}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.white} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.white, letterSpacing: -0.3 }}>Identifying product</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 }}>
            Reading the label, logo and model — then we’ll pull its full intelligence profile.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
