import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import {
  ActionButton,
  AppShell,
  EmptyState,
  MediaFrame,
  StatusMessage,
  StoryCard,
} from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import * as clarity from '@/lib/clarity/api';
import * as living from '@/lib/living/api';
import { browse } from '@/lib/today/api';
import { experienceToFeed, questionToFeed, unmaskToFeed } from '@/lib/unmask/feed';
import { getKnownProduct } from '@/lib/products';
import { useAppStore } from '@/lib/store';

export default function ProductPage() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const pid = routeId(id);
  const router = useRouter();
  const known = useAppStore((s) => s.knownProducts[pid]);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  useEffect(() => {
    if (pid) addRecent(pid);
  }, [pid, addRecent]);

  const catalog = useQuery({
    queryKey: ['catalog', pid],
    queryFn: () => living.catalog(pid),
  });
  const experiences = useQuery({
    queryKey: ['product-experiences', pid],
    queryFn: () => clarity.experiences(false, pid),
  });
  const questions = useQuery({
    queryKey: ['product-questions', pid],
    queryFn: () => living.questions(pid),
  });
  const unmasks = useQuery({
    queryKey: ['product-unmasks', pid],
    queryFn: () => browse(q || known?.name || '', 'All', 'Recent'),
  });

  const row = catalog.data?.[0];
  const product = known || getKnownProduct(pid);
  const name = row?.name || product?.name || q || pid.replace(/-/g, ' ');
  const image = row?.image_url || product?.heroImageUrl;
  const stories = (experiences.data ?? []).map(experienceToFeed);
  const asks = (questions.data ?? []).map((item) => questionToFeed(item, name, image));
  const cases = (unmasks.data ?? [])
    .filter((u) => u.product_id === pid || u.product_name === name)
    .map(unmaskToFeed);

  return (
    <AppShell back title={name} subtitle={row?.brand || product?.brand || 'Lived stories. Updated as people keep using it.'}>
      <MediaFrame uri={image} label={name} overlay />
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
        {stories.length} lived stories · {asks.length} questions · {cases.length} Ultra Unmasks
      </Text>
      <ActionButton label={COPY.createExperience} onPress={() => router.push(`/contribute?product=${pid}` as Href)} />
      <ActionButton tone="secondary" label="Ask the community" onPress={() => router.push(`/product/${pid}/ask-community` as Href)} />

      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.5, color: colors.inkSoft }}>STORIES</Text>
      {experiences.isError ? <StatusMessage kind="error" title="Stories didn’t load." /> : null}
      {stories.length ? (
        stories.map((item) => <StoryCard key={item.id} item={item} />)
      ) : (
        <EmptyState title={COPY.noStories} detail={COPY.noStoriesNext} />
      )}

      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.5, color: colors.inkSoft }}>
        QUESTIONS AND ULTRA UNMASKS
      </Text>
      {asks.map((item) => (
        <StoryCard key={item.id} item={item} />
      ))}
      {cases.map((item) => (
        <StoryCard key={item.id} item={item} />
      ))}

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.5, color: colors.inkSoft }}>ABOUT THIS PRODUCT</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>
          We show what people lived first. If we only have a name and a photo, that’s all you’ll see until someone writes. We don’t invent a full dossier because you opened this page.
        </Text>
        <ActionButton tone="ghost" label="See offers · unmask first" onPress={() => router.push('/offers' as Href)} />
      </View>
    </AppShell>
  );
}
