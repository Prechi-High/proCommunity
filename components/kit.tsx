import type { ComponentType, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { CaretRight, categoryIcon, MagnifyingGlass, Scan, Star, X } from '@/components/icons';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { displayName, formatPrice } from '@/lib/products';
import type { Product } from '@/lib/types';

type IconCmp = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' }>;

export function LargeTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, color: colors.bone, lineHeight: 38 }}>
        {children}
      </Text>
      {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone2 }}>{sub}</Text> : null}
    </View>
  );
}

export function Eyebrow({ children, color = colors.bone3 }: { children: ReactNode; color?: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.semibold,
        fontSize: 12,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </Text>
  );
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onScan,
  onPress,
  autoFocus,
  placeholder = 'Search any product',
  busy,
  animateScan,
}: {
  value?: string;
  onChangeText?: (t: string) => void;
  onSubmit?: () => void;
  onScan?: () => void;
  onPress?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  busy?: boolean;
  animateScan?: boolean;
}) {
  const inner = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          backgroundColor: colors.lac,
          borderRadius: radii.search,
          paddingLeft: 14,
          paddingRight: 6,
          height: 52,
          borderWidth: 1,
          borderColor: colors.line,
        },
        elevation.raised,
      ]}
    >
      <View style={{ flexShrink: 0 }}>
        <MagnifyingGlass size={20} color={colors.bone3} weight="bold" />
      </View>
      {onPress ? (
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 17, color: value ? colors.bone : colors.bone3 }}>
          {value || placeholder}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor={colors.bone3}
          autoCorrect={false}
          style={{ flex: 1, flexShrink: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 17, color: colors.bone, paddingVertical: 0, outlineStyle: 'none' } as never}
        />
      )}
      {value && onChangeText ? (
        <Pressable hitSlop={10} onPress={() => onChangeText('')} accessibilityLabel="Clear search">
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bone3, alignItems: 'center', justifyContent: 'center' }}>
            <X size={11} color={colors.white} weight="bold" />
          </View>
        </Pressable>
      ) : null}
      {onScan && animateScan ? (
        <LiveScanButton busy={busy} onPress={onScan} />
      ) : onScan ? (
        <Pressable
          onPress={() => {
            hapticTap();
            onScan();
          }}
          accessibilityLabel="Search with a photo"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 10,
            backgroundColor: colors.hi,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Scan size={20} color={colors.white} weight="bold" />}
        </Pressable>
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="search">
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/** The photo-search button, alive: a sonar ring, a sweeping scan line and a slow breath. */
function LiveScanButton({ busy, onPress }: { busy?: boolean; onPress: () => void }) {
  const ring = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breath, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [ring, sweep, breath]);

  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityLabel="Search with a photo"
      style={{ width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 40,
          height: 40,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.hi,
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
        }}
      />
      <Animated.View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.hi,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <>
            <Scan size={21} color={colors.white} weight="bold" />
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 7,
                right: 7,
                top: 0,
                height: 2,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.95)',
                shadowColor: '#fff',
                shadowOpacity: 0.9,
                shadowRadius: 4,
                transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [9, 29] }) }],
              }}
            />
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** iOS-style segmented control with a sliding thumb. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: index, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, x]);
  const segW = width ? (width - 4) / options.length : 0;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: colors.wineDeep, borderRadius: 10, padding: 2, height: 36 }}
    >
      {segW ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 2,
              left: 2,
              width: segW,
              bottom: 2,
              borderRadius: 8,
              backgroundColor: colors.lac,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }],
            },
            elevation.raised,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              if (!on) hapticSelect();
              onChange(o.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              numberOfLines={1}
              style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13, color: on ? colors.bone : colors.bone2 }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProductImage({
  uri,
  category,
  size,
  radius = 14,
  style,
}: {
  uri?: string | null;
  category?: string;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const Mark = categoryIcon(category ?? '');
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.white,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.line,
        },
        style,
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: size * 0.86, height: size * 0.86 }}
          resizeMode="contain"
        />
      ) : (
        <Mark size={size * 0.38} color={colors.bone3} weight="regular" />
      )}
    </View>
  );
}

export function Stars({ rating, count, size = 12 }: { rating: number | null | undefined; count?: number | null; size?: number }) {
  if (!rating) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Star size={size} color={colors.honey} weight="fill" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: size + 1, color: colors.bone }}>{rating.toFixed(1)}</Text>
      {count ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: size + 1, color: colors.bone3 }}>
          ({count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : count})
        </Text>
      ) : null}
    </View>
  );
}

export function ProductRow({ product, onPress, trailing }: { product: Product; onPress: () => void; trailing?: ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <ProductImage uri={product.heroImageUrl} category={product.category} size={68} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15.5, color: colors.bone, lineHeight: 20 }}>
          {displayName(product)}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
          {product.category}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
          {product.price ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{formatPrice(product.price)}</Text>
          ) : null}
          <Stars rating={product.rating} count={product.ratingCount} />
        </View>
      </View>
      {trailing ?? <CaretRight size={16} color={colors.bone3} weight="bold" />}
    </Pressable>
  );
}

/** Large feature card for the top result. */
export function FeatureCard({ product, onPress, label }: { product: Product; onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: colors.lac,
          borderRadius: 22,
          padding: 16,
          flexDirection: 'row',
          gap: 16,
          alignItems: 'center',
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        elevation.raised,
      ]}
    >
      <ProductImage uri={product.heroImageUrl} category={product.category} size={112} radius={16} style={{ borderWidth: 0, backgroundColor: colors.lac2 }} />
      <View style={{ flex: 1, gap: 6 }}>
        {label ? <Eyebrow color={colors.hi}>{label}</Eyebrow> : null}
        <Text numberOfLines={3} style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone, lineHeight: 22, letterSpacing: -0.3 }}>
          {displayName(product)}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
          {product.category}
          {product.offers && product.offers > 1 ? ` · ${product.offers} sellers` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {product.price ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{formatPrice(product.price)}</Text>
          ) : null}
          <Stars rating={product.rating} count={product.ratingCount} />
        </View>
      </View>
    </Pressable>
  );
}

export function Tile({
  children,
  style,
  onPress,
  tone = 'white',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'white' | 'ink' | 'accent';
}) {
  const bg = tone === 'ink' ? colors.black : tone === 'accent' ? colors.hi : colors.lac;
  const body = (
    <View style={[{ backgroundColor: bg, borderRadius: 20, padding: 16, overflow: 'hidden' }, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flex: (style as ViewStyle | undefined)?.flex })}
    >
      {body}
    </Pressable>
  );
}

export function ScoreDial({ score, size = 96, stroke = 9, onDark }: { score: number | null; size?: number; stroke?: number; onDark?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const tone = score == null ? colors.bone3 : score >= 75 ? colors.sage : score >= 55 ? colors.honey : colors.coral;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={onDark ? 'rgba(255,255,255,0.16)' : colors.wineDeep} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.32, letterSpacing: -1, color: onDark ? colors.white : colors.bone }}>
        {score == null ? '—' : score}
      </Text>
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon: I }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'; icon?: IconCmp }) {
  const map = {
    neutral: { bg: colors.lac2, fg: colors.bone2 },
    good: { bg: colors.sageSoft, fg: colors.sageInk },
    warn: { bg: colors.honeySoft, fg: colors.honeyInk },
    bad: { bg: colors.coralSoft, fg: colors.coral },
    accent: { bg: colors.hiSoft, fg: colors.hiInk },
  }[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        backgroundColor: map.bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      {I ? <I size={12} color={map.fg} weight="bold" /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: map.fg }}>{label}</Text>
    </View>
  );
}

export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.lac, borderRadius: 16, paddingHorizontal: 16 }, style]}>{children}</View>;
}

export function GroupRow({
  label,
  value,
  onPress,
  last,
  icon: I,
  detail,
  badge,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  icon?: IconCmp;
  detail?: string;
  badge?: string;
}) {
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}
    >
      {I ? <I size={19} color={colors.hi} weight="regular" /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone }}>{label}</Text>
        {detail ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>{detail}</Text> : null}
      </View>
      {badge ? <Pill label={badge} tone="accent" /> : null}
      {value ? (
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone2, maxWidth: '58%', textAlign: 'right' }}>
          {value}
        </Text>
      ) : null}
      {onPress ? <CaretRight size={14} color={colors.bone3} weight="bold" /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon: I,
  tone = 'accent',
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: IconCmp;
  tone?: 'accent' | 'ink' | 'plain';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const bg = tone === 'accent' ? colors.hi : tone === 'ink' ? colors.black : colors.lac2;
  const fg = tone === 'plain' ? colors.bone : colors.white;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          height: 50,
          borderRadius: 14,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 18,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {I ? <I size={18} color={fg} weight="bold" /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function Shimmer({ height, width = '100%', radius = 12, style }: { height: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: colors.wineDeep, opacity: v }, style]} />;
}
