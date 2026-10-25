import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';

type Tone = 'primary' | 'secondary' | 'ghost' | 'gold';

type Props = {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  pending?: boolean;
  disabled?: boolean;
  explanation?: string;
  icon?: ReactNode;
};

const TONES: Record<Tone, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.brandDeep, fg: colors.white },
  secondary: { bg: colors.mist, fg: colors.ink },
  ghost: { bg: 'transparent', fg: colors.brandDeep, border: colors.line },
  gold: { bg: colors.goldSoft, fg: colors.honeyInk },
};

export function ActionButton({
  label,
  onPress,
  tone = 'primary',
  pending,
  disabled,
  explanation,
  icon,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const t = TONES[tone];
  const locked = disabled || pending;
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: locked, busy: pending }}
        accessibilityLabel={label}
        disabled={locked}
        onPressIn={() => {
          setPressed(true);
          hapticSelect();
        }}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
        style={{
          minHeight: 52,
          borderRadius: radii.button,
          backgroundColor: t.bg,
          borderWidth: t.border ? 1 : 0,
          borderColor: t.border,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: locked ? 0.5 : pressed ? 0.88 : 1,
        }}
      >
        {pending ? <ActivityIndicator color={t.fg} /> : icon}
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 16,
            lineHeight: 22,
            color: t.fg,
            letterSpacing: 0.2,
          }}
        >
          {pending ? 'Working…' : label}
        </Text>
      </Pressable>
      {locked && explanation ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
          {explanation}
        </Text>
      ) : null}
    </View>
  );
}
