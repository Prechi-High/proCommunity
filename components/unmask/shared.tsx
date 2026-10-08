import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { CheckCircle, Shield } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import type { DimensionTone } from '@/lib/unmask/types';

export function toneColors(tone: DimensionTone) {
  if (tone === 'positive') return { fg: colors.sage, bg: colors.sageSoft, ink: colors.sageInk };
  if (tone === 'negative') return { fg: colors.coral, bg: colors.coralSoft, ink: colors.coral };
  return { fg: colors.honey, bg: colors.honeySoft, ink: colors.honeyInk };
}

export function scoreBarColor(score: number | null): string {
  if (score === null) return colors.bone3;
  if (score >= 75) return colors.sage;
  if (score >= 55) return colors.honey;
  return colors.coral;
}

export function ScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100) / 100;
  const color = scoreBarColor(score);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: size > 80 ? 26 : 22, color: colors.bone }}>{score ?? '—'}</Text>
        {score !== null ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3 }}>/100</Text> : null}
      </View>
    </View>
  );
}

export function ScoreBar({ score, style }: { score: number | null; style?: ViewStyle }) {
  const pct = score !== null ? Math.min(score, 100) : 0;
  return (
    <View style={[{ height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: scoreBarColor(score), borderRadius: 3 }} />
    </View>
  );
}

export function UnmaskedBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.chip,
        backgroundColor: colors.sageSoft,
      }}
    >
      <Shield size={12} color={colors.sage} weight="fill" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, color: colors.sageInk }}>UNMASKED</Text>
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.bone }}>{title}</Text>
      {subtitle ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function VerdictCheck() {
  return <CheckCircle size={14} color={colors.sage} weight="fill" />;
}
