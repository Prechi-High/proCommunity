import { createElement, useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Button } from '@/components/ui';
import { ArrowSquareOut } from '@/components/icons';
import { colors, radii } from '@/constants/theme';
import { officialEmbedHeight, officialEmbedSrc } from '@/lib/embedUrls';
import { platformLabel, type JourneyClip } from '@/lib/videos';

function loadInstagramEmbed(permalink: string) {
  if (typeof document === 'undefined') return;
  const win = window as unknown as { instgrm?: { Embeds: { process: () => void } } };
  const process = () => win.instgrm?.Embeds.process();
  const existing = document.querySelector('script[src*="instagram.com/embed.js"]');
  if (!existing) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    script.onload = process;
    document.body.appendChild(script);
    return;
  }
  process();
  void permalink;
}

function WatchOnPlatform({ clip }: { clip: JourneyClip }) {
  return (
    <Button
      label={`Watch on ${platformLabel(clip.platform)}`}
      kind="quiet"
      icon={ArrowSquareOut}
      onPress={() => Linking.openURL(clip.sourceUrl)}
    />
  );
}

function PlatformIframe({ src, title, height }: { src: string; title: string; height: number }) {
  return createElement('iframe', {
    src,
    style: { width: '100%', height, border: 0, background: '#000' },
    allow:
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    title,
  });
}

/**
 * Official platform players only. Instagram must run embed.js on the host page;
 * a nested srcDoc/iframe copy is what produced the login wall.
 */
export function OfficialEmbed({ clip, height }: { clip: JourneyClip; height?: number }) {
  const src = officialEmbedSrc(clip.platform, clip.sourceUrl, clip.youtubeVideoId);
  const frameHeight = height ?? officialEmbedHeight(clip.platform);

  useEffect(() => {
    if (Platform.OS === 'web' && clip.platform === 'instagram' && clip.sourceUrl) {
      loadInstagramEmbed(clip.sourceUrl);
    }
  }, [clip.platform, clip.sourceUrl]);

  if (Platform.OS !== 'web') {
    return <WatchOnPlatform clip={clip} />;
  }

  if (clip.platform === 'instagram' && clip.sourceUrl) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.mist }}>
          {createElement('blockquote', {
            className: 'instagram-media',
            'data-instgrm-permalink': clip.sourceUrl.replace(/\?.*$/, ''),
            'data-instgrm-version': '14',
            style: { background: '#fff', margin: 0, maxWidth: '100%', minHeight: frameHeight },
          })}
        </View>
        <WatchOnPlatform clip={clip} />
      </View>
    );
  }

  if (src) {
    return (
      <View style={{ gap: 8 }}>
        <View
          style={{
            borderRadius: radii.card,
            overflow: 'hidden',
            backgroundColor: colors.ink,
            height: frameHeight,
          }}
        >
          <PlatformIframe src={src} title={clip.title || platformLabel(clip.platform)} height={frameHeight} />
        </View>
        {clip.platform !== 'youtube' ? <WatchOnPlatform clip={clip} /> : null}
      </View>
    );
  }

  return <WatchOnPlatform clip={clip} />;
}
