import { Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';

import { ActionButton } from './ActionButton';

export function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ gap: 12, paddingVertical: 40, paddingHorizontal: 8, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 44,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.brandDeep,
          marginBottom: 8,
        }}
      />
      <Text
        style={{
          fontFamily: fonts.serifBold,
          fontSize: 28,
          lineHeight: 32,
          color: colors.ink,
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      {detail ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>{detail}</Text>
      ) : null}
      {action && onAction ? (
        <View style={{ width: '100%', paddingTop: 8 }}>
          <ActionButton label={action} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
