import { createElement } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Button } from '@/components/ui';
import { ArrowSquareOut } from '@/components/icons';
import { colors, radii } from '@/constants/theme';
import { officialEmbedHeight, officialEmbedSrc } from '@/lib/embedUrls';
import { platformLabel, type JourneyClip } from '@/lib/videos';

/**
 * Official platform player only — never a downloaded file, never a sandboxed
 * srcDoc copy of oEmbed HTML (Instagram treats that as logged-out and shows a
 * login wall; Pinterest's widget script never hydrates inside React Native Web).
 */
export function OfficialEmbed({ clip, height }: { clip: JourneyClip; height?: number }) {
  const src = officialEmbedSrc(clip.platform, clip.sourceUrl, clip.youtubeVideoId);
  const frameHeight = height ?? officialEmbedHeight(clip.platform);

  if (Platform.OS === 'web' && src) {
    return (
      <View
        style={{
          borderRadius: radii.card,
          overflow: 'hidden',
          backgroundColor: colors.ink,
          height: frameHeight,
        }}
      >
        {createElement('iframe', {
          src,
          style: { width: '100%', height: frameHeight, border: 0, background: '#000' },
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
          allowFullScreen: true,
          referrerPolicy: 'origin',
          title: clip.title || platformLabel(clip.platform),
        })}
      </View>
    );
  }

  return (
    <Button
      label={`Watch on ${platformLabel(clip.platform)}`}
      kind="quiet"
      icon={ArrowSquareOut}
      onPress={() => Linking.openURL(clip.sourceUrl)}
    />
  );
}
