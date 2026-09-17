import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThreadRow } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { Button, Caption, Heading, Notice } from '@/components/ui';
import { BackButton, ChatsCircle, Lightbulb, Plus } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { getProductThreads, routeId } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

/**
 * 06 — Discussion threads.
 *
 * The feeling is relief: "there's literally a thread for this." That comes from
 * titles being specific enough to recognise your own question in, so the list
 * is title-led and the compose box coaches toward specificity — never intrigue.
 */
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
  const totalReplies = threads.reduce((sum, thread) => sum + thread.replyCount, 0);

  return (
    <Screen
      footer={
        creating ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ask it the way you'd ask a friend"
              placeholderTextColor={colors.inkSoft}
              style={{
                backgroundColor: colors.white,
                borderColor: colors.mist,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: 13,
                fontFamily: fonts.regular,
                fontSize: 14,
                color: colors.ink,
              }}
            />
            <Caption>
              Specific titles get answered. "Does this pill under sunscreen?" beats "Thoughts?"
            </Caption>
            <Button
              label="Start this thread"
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
          <Button label="Ask something new" icon={Plus} onPress={() => setCreating(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Heading size={18}>Conversations</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <ChatsCircle size={13} color={colors.inkSoft} weight="regular" />
        <Caption>
          {`${threads.length} ${threads.length === 1 ? 'thread' : 'threads'} · ${totalReplies} ${totalReplies === 1 ? 'reply' : 'replies'} · each one is a separate question, not a pile of comments`}
        </Caption>
      </View>

      {threads.map((thread) => (
        <ThreadRow key={thread.id} thread={thread} productId={product.id} />
      ))}

      <Notice quiet icon={Lightbulb}>
        Threads are never reordered by sentiment. A thread full of complaints sits in the same list, in
        the same place, as a thread full of praise.
      </Notice>
    </Screen>
  );
}
