import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Play } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';

import { FocusCorners } from './FocusCorners';

export function MediaFrame({
  uri,
  label,
  ratio = 4 / 5,
  compact,
  play,
  overlay,
  corners = true,
}: {
  uri?: string | null;
  label: string;
  ratio?: number;
  compact?: boolean;
  play?: boolean;
  overlay?: boolean;
  corners?: boolean;
}) {
  const r = compact ? 5 / 4 : ratio;
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: '100%',
        aspectRatio: r,
        borderRadius: radii.photo,
        overflow: 'hidden',
        backgroundColor: colors.mist,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#F7F1F2', '#EBD6DA', '#D9B4BA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}
        >
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 11,
              letterSpacing: 1.4,
              color: colors.brand,
            }}
          >
            PRODUCT
          </Text>
          <Text
            numberOfLines={3}
            style={{
              fontFamily: fonts.serifBold,
              fontSize: compact ? 20 : 28,
              lineHeight: compact ? 24 : 32,
              color: colors.brandDeep,
              letterSpacing: -0.5,
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      )}
      {overlay || play ? (
        <LinearGradient
          colors={['rgba(28,25,23,0)', 'rgba(28,25,23,0.55)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%' }}
        />
      ) : null}
      {corners ? <FocusCorners selected ink={!uri} /> : null}
      {play ? (
        <View
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.94)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={22} color={colors.brandDeep} weight="fill" />
        </View>
      ) : null}
    </View>
  );
}
