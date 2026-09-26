import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { OfficialEmbed } from '@/components/VideoEmbed';
import { Caption } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import type { LiteracyEntry } from '@/lib/types';
import type { JourneyClip } from '@/lib/videos';

export function LiteracyRail({
  clips,
  notes,
}: {
  clips: JourneyClip[];
  notes: LiteracyEntry[];
}) {
  const { height } = useWindowDimensions();
  const [active, setActive] = useState<JourneyClip | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);

  if (!clips.length && !notes.length) return null;

  return (
    <View style={{ marginTop: 28, marginBottom: 12 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.bone }}>Learn this product</Text>
      <Caption>Short literacy clips — watch one, then decide</Caption>

      {clips.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingTop: 14, paddingRight: 8 }}
        >
          {clips.slice(0, 4).map((clip) => (
            <Pressable
              key={clip.id}
              onPress={() => {
                hapticTap();
                setActive(clip);
              }}
              style={{ width: 200 }}
            >
              <View
                style={{
                  width: 200,
                  height: 112,
                  borderRadius: radii.photo,
                  overflow: 'hidden',
                  backgroundColor: colors.lac2,
                }}
              >
                {clip.thumbnailUrl ? (
                  <Image source={{ uri: clip.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : null}
                <View
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(18,6,10,0.72)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.hi, fontSize: 12 }}>▶</Text>
                </View>
              </View>
              <Text
                numberOfLines={2}
                style={{ marginTop: 8, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.bone }}
              >
                {clip.title}
              </Text>
              {clip.author ? (
                <Text numberOfLines={1} style={{ marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  {clip.author}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {notes.length ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {notes.map((note) => {
            const open = openNote === note.attributeTag;
            return (
              <Pressable
                key={note.attributeTag}
                onPress={() => setOpenNote(open ? null : note.attributeTag)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: colors.lac,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{note.title}</Text>
                {open ? (
                  <Text style={{ marginTop: 8, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.bone2 }}>
                    {note.body}
                  </Text>
                ) : (
                  <Caption>Tap to read</Caption>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Modal visible={Boolean(active)} animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={{ flex: 1, backgroundColor: colors.shell, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 }}>
            <Pressable onPress={() => setActive(null)} style={{ padding: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.hi }}>Close</Text>
            </Pressable>
            <Text
              numberOfLines={1}
              style={{ flex: 1, marginLeft: 8, fontFamily: fonts.medium, color: colors.bone }}
            >
              {active?.title}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40, minHeight: height * 0.7 }}>
            {active ? <OfficialEmbed clip={active} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
