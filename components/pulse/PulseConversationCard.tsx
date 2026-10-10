import { Pressable, Text, View } from 'react-native';

import { ChatCircle } from '@/components/icons';
import { ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import type { TrendingProduct } from '@/lib/types';

export function PulseConversationCard({
  title,
  postCount,
  item,
  width,
  onPress,
}: {
  title: string;
  postCount: number;
  item: TrendingProduct;
  width: number;
  onPress: () => void;
}) {
  const imageSize = width;
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ width, gap: 6, opacity: pressed ? 0.85 : 1 })}
    >
      <ProductImage uri={item.image} category={item.category} size={imageSize} radius={10} style={{ width: imageSize, height: imageSize }} />
      <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 14, color: colors.bone }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <ChatCircle size={12} color={colors.bone3} weight="bold" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.bone3 }}>{postCount} posts</Text>
      </View>
    </Pressable>
  );
}
