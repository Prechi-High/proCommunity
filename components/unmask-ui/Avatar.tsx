import { Image, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { avatarTone, initials } from '@/lib/unmask/time';

export function Avatar({
  name,
  uri,
  size = 36,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const bg = avatarTone(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={name || 'Person'}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: size * 0.36,
            color: colors.white,
            letterSpacing: 0.2,
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
