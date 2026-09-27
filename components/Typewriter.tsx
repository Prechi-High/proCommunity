import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, type TextStyle } from 'react-native';

import { colors } from '@/constants/theme';

export interface TypedLine {
  line: string;
  sub: string;
}

const TYPE_MS = 42;
const DELETE_MS = 20;
const HOLD_MS = 2800;

/** Types a headline, holds it, deletes it and writes the next — with its subline fading in underneath. */
export function Typewriter({ lines, style, subStyle, minLines = 2 }: { lines: TypedLine[]; style: TextStyle; subStyle: TextStyle; minLines?: number }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(lines[0]?.line ?? '');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('holding');
  const caret = useRef(new Animated.Value(1)).current;
  const sub = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 450, delay: 250, useNativeDriver: true }),
        Animated.timing(caret, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [caret]);

  useEffect(() => {
    const target = lines[index]?.line ?? '';
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'holding') {
      Animated.timing(sub, { toValue: 1, duration: 380, useNativeDriver: true }).start();
      t = setTimeout(() => setPhase('deleting'), HOLD_MS);
    } else if (phase === 'deleting') {
      if (shown.length === 0) {
        setIndex((i) => (i + 1) % lines.length);
        setPhase('typing');
      } else {
        if (shown.length === target.length) Animated.timing(sub, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        t = setTimeout(() => setShown((s) => s.slice(0, -1)), DELETE_MS);
      }
    } else {
      if (shown === target) setPhase('holding');
      else t = setTimeout(() => setShown(target.slice(0, shown.length + 1)), TYPE_MS + (/[.,?!—]/.test(target[shown.length - 1] ?? '') ? 180 : 0));
    }
    return () => clearTimeout(t);
  }, [phase, shown, index, lines, sub]);

  const lineHeight = style.lineHeight ?? (style.fontSize ?? 20) * 1.15;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ minHeight: lineHeight * minLines, justifyContent: 'flex-end' }}>
        <Text style={style} accessibilityLiveRegion="polite">
          {shown}
          <Animated.Text style={{ opacity: caret, color: colors.hi, fontWeight: '300' }}>|</Animated.Text>
        </Text>
      </View>
      <Animated.Text
        style={[subStyle, { opacity: sub, transform: [{ translateY: sub.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}
      >
        {lines[index]?.sub}
      </Animated.Text>
    </View>
  );
}
