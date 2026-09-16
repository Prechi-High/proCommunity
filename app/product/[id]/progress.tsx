import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Badge, Body, Button, Caption, Card, Heading, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { useProduct } from '@/lib/useProduct';
import { useAppStore } from '@/lib/store';

export default function ProgressScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const entries = useAppStore((s) => s.progressEntries).filter((entry) => entry.productId === id);
  const addProgressEntry = useAppStore((s) => s.addProgressEntry);
  const setProgressShared = useAppStore((s) => s.setProgressShared);
  const addPost = useAppStore((s) => s.addPost);
  const profile = useAppStore((s) => s.profile);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }

  if (!product) return null;

  return (
    <Screen
      footer={
        adding ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What changed this week?"
              placeholderTextColor={colors.inkSoft}
              multiline
              style={{
                minHeight: 70,
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
              label="Save privately"
              disabled={!note.trim()}
              onPress={() => {
                addProgressEntry({
                  productId: product.id,
                  note: note.trim(),
                  entryDate: new Date().toISOString(),
                  weekLabel: `Week ${entries.length + 1} · Today`,
                  isShared: false,
                });
                setNote('');
                setAdding(false);
              }}
            />
          </View>
        ) : (
          <Button label="+ Add entry" onPress={() => setAdding(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <View>
          <Heading size={16}>Your progress</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>
      <Badge label="🔒 Private to you" />
      {entries.length === 0 ? (
        <Caption>
          Entries stay private unless you share one. Sharing is per entry — there is no bulk share.
        </Caption>
      ) : null}
      {entries.map((entry, index) => (
        <View key={entry.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                backgroundColor: colors.mist,
              }}
            />
            <View style={{ flex: 1 }}>
              <Title>{entry.weekLabel}</Title>
              <Caption>{entry.note}</Caption>
              {entry.isShared ? <Badge label="Shared to community" tone="sage" /> : null}
            </View>
          </View>
          {!entry.isShared && index === 0 ? (
            <Card>
              <Title>Share this entry with the community?</Title>
              <Caption>Only this entry. Your other entries stay private.</Caption>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Keep private" kind="outline" onPress={() => undefined} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Share"
                    onPress={() => {
                      setProgressShared(entry.id, true);
                      addPost({
                        productId: product.id,
                        authorName: profile?.displayName ?? 'You',
                        userId: profile?.id ?? 'anon',
                        type: 'update',
                        body: entry.note,
                        traitTags: ['Progress photo'],
                        isVerifiedOwner: true,
                      });
                    }}
                  />
                </View>
              </View>
            </Card>
          ) : null}
          {index < entries.length - 1 ? (
            <View style={{ height: 1, backgroundColor: colors.mist }} />
          ) : null}
        </View>
      ))}
      <Body color={colors.inkSoft}>
        Photos stay on-device in this preview. Connect Supabase Storage to upload them privately.
      </Body>
    </Screen>
  );
}
