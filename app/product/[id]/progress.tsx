import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Badge, Body, Button, Caption, Card, Heading, Title } from '@/components/ui';
import { BackButton, Camera, Check, Lock, NotePencil, Plus, ShareNetwork } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { useProduct } from '@/lib/useProduct';
import { useAppStore } from '@/lib/store';

/**
 * 08 — Progress journal.
 *
 * Private by default, because psychological safety is what lets someone be
 * honest with themselves first — and that honesty is exactly what makes an
 * entry worth reading if they ever do share it. There is deliberately no
 * prompt asking anyone to share: the option sits quietly on each entry and
 * only opens when the person reaches for it, so sharing stays their idea.
 */
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
  const [confirmingShare, setConfirmingShare] = useState<string | null>(null);

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
              placeholder="What changed this week? Nobody else sees this."
              placeholderTextColor={colors.inkSoft}
              multiline
              autoFocus
              style={{
                minHeight: 78,
                backgroundColor: colors.white,
                borderColor: colors.mist,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: 12,
                fontFamily: fonts.regular,
                fontSize: 14,
                color: colors.ink,
              }}
            />
            <Button
              label="Save to my journal"
              icon={Lock}
              disabled={!note.trim()}
              onPress={() => {
                addProgressEntry({
                  productId: product.id,
                  note: note.trim(),
                  entryDate: new Date().toISOString(),
                  weekLabel: `Week ${entries.length + 1}`,
                  isShared: false,
                });
                setNote('');
                setAdding(false);
              }}
            />
          </View>
        ) : (
          <Button label="Add an entry" icon={Plus} onPress={() => setAdding(true)} />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1, gap: 3 }}>
          <Heading size={19}>Your progress</Heading>
          <Caption>{product.name}</Caption>
        </View>
      </View>

      {/* Privacy is the first thing established, not a footnote. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.sageSoft,
          borderRadius: radii.card,
          padding: 13,
        }}
      >
        <Lock size={17} color={colors.sage} weight="fill" />
        <View style={{ flex: 1 }}>
          <Title>Only you can see this</Title>
          <Caption>
            Entries are private by default. Sharing happens one entry at a time, and only if you decide
            to.
          </Caption>
        </View>
      </View>

      {entries.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 28 }}>
          <NotePencil size={25} color={colors.inkSoft} weight="regular" />
          <Title>Nothing written down yet</Title>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12.5,
              lineHeight: 19,
              color: colors.inkSoft,
              textAlign: 'center',
              maxWidth: 270,
            }}
          >
            A line a week is enough. In two months this is the only honest record you will have of what
            actually changed.
          </Text>
        </Card>
      ) : null}

      {/* A timeline the person built themselves — which is what makes it worth
          more to them than any generic review. */}
      {entries.map((entry, index) => (
        <View key={entry.id} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center', width: 12 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: entry.isShared ? colors.sage : colors.rosewood,
                marginTop: 6,
              }}
            />
            {index < entries.length - 1 ? (
              <View style={{ flex: 1, width: 1.5, backgroundColor: colors.mist, marginTop: 4 }} />
            ) : null}
          </View>

          <View style={{ flex: 1, gap: 9, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', gap: 11 }}>
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 10,
                  backgroundColor: colors.mist,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={19} color={colors.inkSoft} weight="regular" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Title>{entry.weekLabel}</Title>
                <Body color={colors.ink}>{entry.note}</Body>
              </View>
            </View>

            {entry.isShared ? (
              <Badge label="You shared this one" tone="sage" icon={Check} />
            ) : confirmingShare === entry.id ? (
              <Card style={{ gap: 10, backgroundColor: colors.shell }}>
                <Title>Share just this entry?</Title>
                <Caption>
                  Every other entry stays private. You can keep writing here either way.
                </Caption>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Not this one"
                      kind="quiet"
                      onPress={() => setConfirmingShare(null)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Share it"
                      onPress={() => {
                        setProgressShared(entry.id, true);
                        addPost({
                          productId: product.id,
                          authorName: profile?.displayName ?? 'You',
                          userId: profile?.id ?? 'anon',
                          type: 'update',
                          body: entry.note,
                          traitTags: [entry.weekLabel],
                          isVerifiedOwner: true,
                        });
                        setConfirmingShare(null);
                      }}
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <Pressable
                onPress={() => setConfirmingShare(entry.id)}
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
              >
                <ShareNetwork size={13} color={colors.inkSoft} weight="regular" />
                <Caption>Share this entry</Caption>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      <Caption>
        Photos stay on this device in the preview build. Connecting Supabase Storage uploads them to
        your own private bucket.
      </Caption>
    </Screen>
  );
}
