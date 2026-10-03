import { Text, View } from 'react-native';

import { Caption } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';

export type DayPoint = { date: string; value: number };

function shortLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MiniBarChart({
  title,
  hint,
  data,
  color = colors.hi,
  maxBars = 14,
}: {
  title: string;
  hint?: string;
  data: DayPoint[];
  color?: string;
  maxBars?: number;
}) {
  const slice = data.length > maxBars ? data.slice(-maxBars) : data;
  const max = Math.max(1, ...slice.map((d) => d.value));

  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{title}</Text>
        {hint ? <Caption>{hint}</Caption> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120, paddingTop: 8 }}>
        {slice.map((point) => {
          const h = Math.max(4, Math.round((point.value / max) * 96));
          return (
            <View key={point.date} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.bone3 }}>{point.value || ''}</Text>
              <View
                style={{
                  width: '100%',
                  maxWidth: 28,
                  height: h,
                  borderRadius: 6,
                  backgroundColor: color,
                  opacity: point.value ? 1 : 0.25,
                }}
              />
              <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.bone3, textAlign: 'center' }} numberOfLines={1}>
                {shortLabel(point.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
