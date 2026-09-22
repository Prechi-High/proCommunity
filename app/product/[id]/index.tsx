import { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import { ScoreBadge } from '@/components/ScoreBadge';
import { Caption, Disclaimer, Heading } from '@/components/ui';
import { ArrowLeft, ChatCircle, Heart, categoryIcon } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { getProductThreads, routeId } from '@/lib/catalog';
import { hapticMarked, hapticTap, hapticVerdictLand } from '@/lib/haptics';
import { loadProductCase } from '@/lib/productCase';
import { useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

export default function ProductCaseScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = routeId(rawId ?? '');
  const router = useRouter();
  const { data: product, isLoading: productLoading } = useProduct(id);
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  const analysisQuery = useQuery({
    queryKey: ['product-case', product?.id],
    queryFn: () => loadProductCase(product!, userPosts),
    enabled: Boolean(product),
    staleTime: 30 * 60 * 1000,
  });
  const analysis = analysisQuery.data;

  useEffect(() => {
    if (analysis?.productScore != null) {
      hapticVerdictLand();
      hapticMarked();
    }
  }, [analysis?.analyzedAt, analysis?.productScore]);

  if (productLoading || !product) {
    return <Screen><ActivityIndicator color={colors.hi} style={{ marginTop: 48 }} /><Caption>{productLoading ? 'Gathering product details…' : 'Product not found.'}</Caption></Screen>;
  }

  const saved = favorites.some((item) => item.productId === product.id);
  const score = analysis?.productScore ?? null;
  const Icon = categoryIcon(product.category);
  const threads = getProductThreads(product.id, userThreads, userPosts).slice(0, 2);
  const evidence = analysis?.counts;

  return (
    <Screen scroll={false} padded={false} footer={<View style={{ flexDirection: 'row', gap: 10 }}><Pressable onPress={() => { hapticTap(); toggleFavorite(product.id); }} accessibilityLabel="Save product" style={{ width: 58, height: 58, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: saved ? colors.lac2 : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Heart size={22} color={saved ? colors.hi : colors.bone} weight={saved ? 'fill' : 'regular'} /></Pressable><Pressable onPress={() => { hapticTap(); router.push(`/product/${product.id}/community`); }} style={{ flex: 1, height: 58, borderRadius: 18, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.wine }}>Ask the community</Text></Pressable></View>}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 }}><Pressable onPress={() => { hapticTap(); router.back(); }} accessibilityLabel="Go back" style={{ width: 44, height: 44, justifyContent: 'center' }}><ArrowLeft size={22} color={colors.bone} weight="bold" /></Pressable><Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.medium, color: colors.bone2 }}>Product case</Text><Pressable onPress={() => { hapticTap(); router.push(`/product/${product.id}/community`); }} accessibilityLabel="Open community" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ChatCircle size={21} color={colors.hi} weight="fill" /></Pressable></View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 12 }}><View style={{ flex: 1 }}><Caption>{product.brand}</Caption><Heading size={30}>{product.name}</Heading></View>{product.heroImageUrl ? <Image source={{ uri: product.heroImageUrl }} style={{ width: 62, height: 82, borderRadius: 14, backgroundColor: colors.lac }} resizeMode="cover" /> : <View style={{ width: 62, height: 82, borderRadius: 14, backgroundColor: colors.lac2, alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color={colors.bone2} weight="regular" /></View>}</View>
        <ScoreBadge score={score} />
        {analysisQuery.isLoading ? <ActivityIndicator color={colors.hi} style={{ marginTop: 40 }} /> : analysis?.tooFew ? <View style={{ marginTop: 24, padding: 18, borderRadius: 20, backgroundColor: colors.lac }}><Heading size={25}>Not enough lived evidence yet.</Heading><Caption>{analysis.basis}</Caption></View> : <View style={{ marginTop: 18, padding: 18, borderRadius: 22, backgroundColor: colors.lac }}><Text style={{ fontFamily: fonts.serif, fontSize: 74, lineHeight: 76, color: colors.bone }}>{score}</Text><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>Product Score</Text><Text style={{ marginTop: 12, fontFamily: fonts.serif, fontSize: 22, lineHeight: 28, color: colors.bone }}>{analysis?.verdict}</Text><Text style={{ marginTop: 14, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.bone2 }}>{analysis?.basis}</Text></View>}
        <View style={{ marginTop: 22 }}><Heading size={23}>Where the signal comes from</Heading><View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>{[['YouTube', evidence?.yt ?? 0], ['Reddit', evidence?.rd ?? 0], ['Owners', evidence?.own ?? 0]].map(([label, count]) => <View key={String(label)} style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.lac2 }}><Text style={{ fontFamily: fonts.semibold, color: colors.bone }}>{count}</Text><Caption>{label}</Caption></View>)}</View></View>
        {analysis?.clusters?.map((cluster) => <View key={cluster.title} style={{ marginTop: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.line }}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{cluster.title}</Text><Caption>{cluster.percent}% · {cluster.who}</Caption>{cluster.quotes.slice(0, 2).map((quote, index) => <Text key={`${quote.text}-${index}`} style={{ marginTop: 10, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>“{quote.text}”</Text>)}</View>)}
        <View style={{ marginTop: 24 }}><Heading size={23}>What’s in it</Heading>{product.ingredients.slice(0, 6).map((ingredient) => <View key={ingredient} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}><Text style={{ fontFamily: fonts.medium, color: colors.bone }}>{ingredient}</Text></View>)}<Disclaimer compact /></View>
        <View style={{ marginTop: 24 }}><Heading size={23}>People are asking</Heading>{threads.length ? threads.map((thread) => <View key={thread.id} style={{ marginTop: 10 }}><Text style={{ fontFamily: fonts.regular, lineHeight: 21, color: colors.bone2 }}>{thread.title}</Text></View>) : <Caption>No conversations yet. Ask the first question.</Caption>}</View>
      </ScrollView>
    </Screen>
  );
}
