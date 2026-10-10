import { Image, Pressable, Text, View } from 'react-native';

import { Avatar, compact } from '@/components/community';
import { ArrowFatUp, BookmarkSimple, ChatCircleDots, DotsThree } from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { useThreadActions } from '@/components/social';
import { colors, fonts } from '@/constants/theme';
import { nicheLabel, nicheOf, timeAgo } from '@/lib/community';
import { hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { CommunityThread, ThreadKind } from '@/lib/types';

function pulseKindLabel(kind: ThreadKind): string {
  if (kind === 'compare') return 'Test';
  if (kind === 'question') return 'Question';
  return 'Experience';
}

function pulseKindColors(kind: ThreadKind) {
  if (kind === 'question') return { bg: '#E8F0FA', fg: '#1A5FB4' };
  if (kind === 'compare') return { bg: '#E5F4EE', fg: '#1A6B52' };
  return { bg: colors.hi, fg: colors.white };
}

export function PulsePostCard({
  thread,
  requireMember,
  onOpen,
  onProduct,
  onImage,
}: {
  thread: CommunityThread;
  requireMember: (then: () => void) => void;
  onOpen: () => void;
  onProduct: (id: string, name: string) => void;
  onImage?: (url: string) => void;
}) {
  const a = useThreadActions(thread, requireMember);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const saved = favorites.some((f) => f.productId === thread.product_id);
  const kindColors = pulseKindColors(thread.kind);
  const niche = nicheLabel(nicheOf(thread.category));
  const heroUri = thread.image_url ?? thread.product_image;
  const isCompare = thread.kind === 'compare' && thread.compare_image;

  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onOpen();
      }}
      style={({ pressed }) => ({
        backgroundColor: colors.lac,
        borderRadius: 14,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Avatar name={thread.author_name} size={36} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{thread.author_name}</Text>
            {thread.is_owner ? (
              <View style={{ backgroundColor: colors.coralSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.coral }}>Verified owner</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{timeAgo(thread.created_at)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: kindColors.bg }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: kindColors.fg }}>{pulseKindLabel(thread.kind)}</Text>
          </View>
          <Pressable hitSlop={8} accessibilityLabel="More options" style={{ padding: 4 }}>
            <DotsThree size={18} color={colors.bone3} weight="bold" />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => {
          hapticTap();
          onProduct(thread.product_id, thread.product_name);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.75 : 1 })}
      >
        <ProductImage uri={thread.product_image} category={thread.category ?? ''} size={22} radius={6} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.bone }}>
          {thread.product_name}
          {thread.compare_name ? ` vs ${thread.compare_name}` : ''}
        </Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.lac2, borderWidth: 1, borderColor: colors.line }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.bone2 }}>{niche}</Text>
        </View>
      </Pressable>

      {heroUri ? (
        <Pressable
          onPress={() => {
            if (thread.image_url) onImage?.(thread.image_url);
            else onOpen();
          }}
          accessibilityLabel="View product image"
        >
          {isCompare ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
              <ProductImage uri={thread.product_image} category={thread.category ?? ''} size={88} radius={12} />
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bone, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.white }}>VS</Text>
              </View>
              <ProductImage uri={thread.compare_image} category={thread.category ?? ''} size={88} radius={12} />
            </View>
          ) : (
            <Image source={{ uri: heroUri }} style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: colors.lac2 }} resizeMode="cover" />
          )}
        </Pressable>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.3, color: colors.bone }}>{thread.title}</Text>
        {thread.body ? (
          <Text numberOfLines={5} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
            {thread.body}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 }}>
        <Pressable onPress={a.vote} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={6}>
          <ArrowFatUp size={18} color={a.voted ? colors.hi : colors.bone3} weight={a.voted ? 'fill' : 'bold'} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone2 }}>
            Useful{a.votes ? ` ${compact(a.votes)}` : ''}
          </Text>
        </Pressable>
        <Pressable onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={6}>
          <ChatCircleDots size={18} color={colors.bone3} weight="bold" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone2 }}>
            {thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            hapticTap();
            toggleFavorite(thread.product_id);
          }}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <BookmarkSimple size={18} color={saved ? colors.hi : colors.bone3} weight={saved ? 'fill' : 'regular'} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone2 }}>Save</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
