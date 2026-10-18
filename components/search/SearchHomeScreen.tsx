import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SearchBar } from '@/components/kit';
import { Page, Card, Tag, Body, Button, Title, design } from '@/components/living/ui';
import { colors as c, fonts as f } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { useScan } from '@/lib/useScan';
import { track } from '@/lib/analytics';
import { MagnifyingGlass, Scan, ArrowRight } from '@/components/icons';

export function SearchHomeScreen() {
 const router = useRouter(); const scan = useScan(); const [query, setQuery] = useState('');
 const history = useAppStore(s => s.searchHistory); const { width } = useWindowDimensions();
 const go = (value: string) => { const q = value.trim(); if (!q) return; track('product_search_started', { query: q }); useAppStore.getState().addSearch(q); router.push({ pathname: '/results', params: { q } } as Href); };
 return <Page eyebrow="YOUR PRODUCT INVESTIGATOR" title="Look beyond the claim." sub="Before you buy, see what happened to people who already used it.">
  <View style={{ backgroundColor: c.brandDeep, borderRadius: 24, padding: width > 760 ? 36 : 22, gap: 22 }}>
   <Tag text="Skincare is our first chapter" tone="gold" />
   <Text style={{ fontFamily: f.serif, fontSize: width > 760 ? 44 : 31, lineHeight: width > 760 ? 49 : 37, color: c.white }}>What are you about to bring home?</Text>
   <SearchBar value={query} onChangeText={setQuery} onSubmit={() => go(query)} onScan={scan.start} busy={scan.busy} placeholder="Search a product or brand…" />
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Button quiet label="Search product →" disabled={!query.trim()} onPress={() => go(query)} /><Button quiet label={scan.busy ? 'Reading your photo…' : 'Scan / upload a photo'} disabled={scan.busy} onPress={scan.start} /></View>
   <Text style={{ fontFamily: f.regular, fontSize: 12, lineHeight: 19, color: '#E0CFCF' }}>Company claims. Real experiences. What is still unknown. No account needed to explore.</Text>
  </View>
  {history.length ? <View style={{ gap: 12 }}><Text style={design.label}>PICK UP YOUR CURIOSITY</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{history.slice(0, 6).map(({ query: q }) => <Pressable key={q} accessibilityRole="button" onPress={() => go(q)} style={{ minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.white, paddingHorizontal: 16, justifyContent: 'center' }}><Text style={design.body}>{q} ↗</Text></Pressable>)}</View></View> : null}
  <Title>Clarity before commitment.</Title>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{[
   { n: '01', title: 'Find the exact product.', text: 'Search by name or photograph the label. Check the brand, variant and size.', Icon: Scan },
   { n: '02', title: 'See the whole picture.', text: 'Start with a short overview. Compare claims with reported experience, then open the sources.', Icon: MagnifyingGlass },
   { n: '03', title: 'Watch what happens next.', text: 'Follow the product, compare options or keep your own private history of use.', Icon: ArrowRight },
  ].map(({ n, title, text, Icon }) => <View key={n} style={{ flex: 1, minWidth: 240 }}><Card><View style={[design.row, { justifyContent: 'space-between' }]}><Text style={design.label}>{n}</Text><Icon size={23} color={c.brand} /></View><Text style={[design.title, { fontSize: 26 }]}>{title}</Text><Body>{text}</Body></Card></View>)}</View>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ flex: 1, minWidth: 240 }}><Card tone="sage"><Tag text="ONE PRODUCT. MANY EXPERIENCES." tone="sage" /><Title>See the story after the sale.</Title><Body>Explore shared routines, changing opinions and questions from people who have used the product.</Body><Button quiet label="Explore community →" onPress={() => router.push('/pulse' as Href)} /></Card></View><View style={{ flex: 1, minWidth: 240 }}><Card><Tag text="CAN’T FIND IT?" /><Title>Bring your question.</Title><Body>Request a missing product. We will keep it on your list while its product story develops.</Body><Button quiet label="Request a product →" onPress={() => router.push('/products?section=requests' as Href)} /></Card></View></View>
  {scan.sheet}
 </Page>;
}
