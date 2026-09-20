import { type ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { hapticSignature, hapticTap } from '@/lib/haptics';
import { unlockAudio } from '@/lib/sounds';

let firstPress = true;

/**
 * Pressable that always fires a short haptic (and unlocks audio on first press).
 */
export function HapticPressable({
  onPress,
  onPressIn,
  children,
  skipHaptic,
  ...rest
}: PressableProps & { children?: ReactNode; skipHaptic?: boolean }) {
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!skipHaptic) {
          if (firstPress) {
            firstPress = false;
            unlockAudio();
            hapticSignature();
          } else {
            hapticTap();
          }
        }
        onPressIn?.(e);
      }}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}
