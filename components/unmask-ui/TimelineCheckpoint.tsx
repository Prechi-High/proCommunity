import { Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';

import { MediaFrame } from './MediaFrame';

export function TimelineCheckpoint({
  date,
  note,
  photo,
  privateNote = true,
}: {
  date: string;
  note: string;
  photo?: string | null;
  privateNote?: boolean;
}) {
  const label = new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={{ gap: 12, paddingVertical: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>{label}</Text>
      {photo ? <MediaFrame uri={photo} label={note || 'Checkpoint photo'} ratio={1} /> : null}
      {note ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink }}>{note}</Text>
      ) : null}
      {privateNote ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
          Only you can see this update.
        </Text>
      ) : null}
    </View>
  );
}
