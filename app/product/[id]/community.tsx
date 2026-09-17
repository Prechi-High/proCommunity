import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThreadRow } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Button, Caption, Heading } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { getProductThreads, routeId } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

export default function CommunityScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const userPosts = useAppStore((state) => state.userPosts);
  const userThreads = useAppStore((state) => state.userThreads);
  const addThread = useAppStore((state) => state.addThread);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }
  if (!product) return null;

  const threads = getProductThreads(product.id, userThreads, userPosts);

  return (
    <Screen
      footer={
        creating ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Name the thread — e.g. Does this pill under SPF?"
              placeholderTextColor={colors.inkSoft}
              style={{
                backgroundColor: colors.white,
                borderColor: colors.mist,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: 12,
                fontFamily: fonts.regular,
                color: colors.ink,
              }}
            />
            <Button
              label="Start thread"
              disabled={title.trim().length < 6}
              onPress={() => {
                const threadId = addThread(product.id, title.trim());
                setTitle('');
                setCreating(false);
                router.push(`/product/${product.id}/thread/${threadId}`);
              }}
            />
          </View>
        ) : (
          <Button label="+ Start a new thread" onPress={() => setCreating(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <View>
          <Heading size={16}>Discussions</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>
      <Caption>Named threads, not one undifferentiated Q&A. Honest criticism stays visible.</Caption>
      {threads.map((thread) => (
        <ThreadRow key={thread.id} thread={thread} productId={product.id} />
      ))}
    </Screen>
  );
}
