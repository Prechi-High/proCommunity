import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { CaretRight } from '@/components/icons';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import type { FeedItem } from '@/lib/unmask/feed';
import { relativeTime } from '@/lib/unmask/time';

import { Avatar } from './Avatar';
import { MediaFrame } from './MediaFrame';
import { SparkMeter } from './SparkMeter';

function Byline({ item }: { item: FeedItem }) {
  const when = relativeTime(item.createdAt);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Avatar name={item.author} uri={item.creatorAvatar} size={28} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft }} numberOfLines={1}>
        {item.author}
        {when ? `  ·  ${when}` : ''}
        {item.sample ? '  ·  Sample' : ''}
      </Text>
    </View>
  );
}

function Meta({ item }: { item: FeedItem }) {
  const bits = [
    item.productName,
    ...item.chips.filter((c) => c !== 'Sample' && c !== item.status),
    item.replies ? `${item.replies} ${item.replies === 1 ? 'reply' : 'replies'}` : '',
  ].filter(Boolean);
  if (!bits.length) return null;
  return (
    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }} numberOfLines={1}>
      {bits.join('  ·  ')}
    </Text>
  );
}

function Cta({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.brandDeep }}>{label}</Text>
      <CaretRight size={14} color={colors.brandDeep} weight="bold" />
    </View>
  );
}

export function StoryCard({ item, featured, flush }: { item: FeedItem; featured?: boolean; flush?: boolean }) {
  const router = useRouter();
  const media = item.photo || item.productImage;
  const pad = flush ? 20 : 0;
  const rule = flush ? 1 : 0;
  const go = () => {
    hapticSelect();
    router.push(item.href as Href);
  };

  if (item.kind === 'question') {
    return (
      <Pressable
        onPress={go}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}. ${item.cta}`}
        style={{ paddingHorizontal: pad, paddingVertical: 20, gap: 14, borderBottomWidth: rule, borderBottomColor: colors.line }}
      >
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <View style={{ width: 88, height: 88 }}>
            <MediaFrame uri={item.productImage} label={item.productName || 'Product'} ratio={1} corners={false} />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.serifBold,
              fontSize: 22,
              lineHeight: 26,
              color: colors.ink,
              letterSpacing: -0.4,
            }}
          >
            {item.title}
          </Text>
        </View>
        <Byline item={item} />
        <Meta item={item} />
        <Cta label={COPY.answerCta} />
      </Pressable>
    );
  }

  if (item.kind === 'unmask') {
    return (
      <Pressable
        onPress={go}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}. ${item.cta}`}
        style={{ paddingBottom: 8, borderBottomWidth: rule, borderBottomColor: colors.line }}
      >
        <View style={{ paddingHorizontal: pad, paddingTop: flush ? 8 : 0 }}>
          <View style={{ position: 'relative' }}>
            <MediaFrame uri={media} label={item.productName || item.title} ratio={16 / 10} play overlay={!!media} />
            {item.status ? (
              <View
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(28,25,23,0.72)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>{item.status}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ paddingHorizontal: pad, paddingTop: 16, paddingBottom: 20, gap: 10 }}>
          <Text
            style={{
              fontFamily: fonts.serifBold,
              fontSize: featured ? 26 : 22,
              lineHeight: featured ? 30 : 26,
              color: colors.ink,
              letterSpacing: -0.45,
            }}
          >
            {item.title}
          </Text>
          <Byline item={item} />
          <Meta item={item} />
          {typeof item.sparks === 'number' ? <SparkMeter weight={item.sparks} compact /> : null}
          <Cta label={item.cta} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={go}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${item.cta}`}
      style={{ borderBottomWidth: rule, borderBottomColor: colors.line, paddingBottom: 8 }}
    >
      <View style={{ paddingHorizontal: pad, paddingTop: flush ? 8 : 0 }}>
        <View style={{ position: 'relative' }}>
          <MediaFrame
            uri={media}
            label={item.productName || item.title}
            overlay={!!media}
            ratio={media ? 4 / 5 : 5 / 4}
          />
          {media && item.productName ? (
            <LinearGradient
              colors={['rgba(28,25,23,0)', 'rgba(28,25,23,0.55)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, justifyContent: 'flex-end', height: 88 }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>{item.productName}</Text>
            </LinearGradient>
          ) : null}
        </View>
      </View>
      <View style={{ paddingHorizontal: pad, paddingTop: 16, paddingBottom: 20, gap: 10 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 20,
            lineHeight: 26,
            color: colors.ink,
            letterSpacing: -0.3,
          }}
        >
          {item.title}
        </Text>
        <Byline item={item} />
        <Meta item={item} />
        <Cta label={COPY.readStory} />
      </View>
    </Pressable>
  );
}
