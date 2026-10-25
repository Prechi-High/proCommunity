import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { colors, fonts } from '@/constants/theme';

import { Avatar } from './Avatar';

type Creator = {
  user_id: string;
  display_name: string;
  handle?: string | null;
  avatar_url?: string | null;
};

export function CreatorStrip({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  if (!creators.length) {
    return (
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft, paddingHorizontal: 20 }}>
        Unmasker profiles appear here after their first Ultra Unmask.
      </Text>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20 }}>
      {creators.map((c) => (
        <Pressable
          key={c.user_id}
          onPress={() => router.push(`/member/${c.user_id}` as Href)}
          style={{ width: 76, alignItems: 'center', gap: 8 }}
        >
          <Avatar name={c.display_name} uri={c.avatar_url} size={64} />
          <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink, textAlign: 'center' }}>
            {c.display_name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
