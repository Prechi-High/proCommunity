import { Text, View } from 'react-native';

import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';

export function ClarityLayers() {
  return (
    <View style={{ gap: 10 }}>
      {[
        { n: '1', title: COPY.layerOneTitle, body: COPY.layerOneBody },
        { n: '2', title: COPY.layerTwoTitle, body: COPY.layerTwoBody },
      ].map((row) => (
        <View
          key={row.n}
          style={{
            flexDirection: 'row',
            gap: 14,
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.stage,
            alignItems: 'flex-start',
          }}
        >
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 22, lineHeight: 26, color: colors.brandDeep, width: 22 }}>
            {row.n}
          </Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{row.title}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{row.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
