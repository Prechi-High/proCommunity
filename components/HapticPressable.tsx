import { type ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { hapticSelect } from '@/lib/haptics';

/**
 * Pressable that acknowledges a tap without decorative haptic tours.
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
        if (!skipHaptic) hapticSelect();
        onPressIn?.(e);
      }}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}
