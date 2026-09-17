import { createElement, useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Button } from '@/components/ui';
import { ArrowSquareOut } from '@/components/icons';
import { colors, radii } from '@/constants/theme';
import { platformLabel, type JourneyClip } from '@/lib/videos';

function srcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#000;display:flex;justify-content:center;}iframe,blockquote{max-width:100%;}</style></head><body>${html}</body></html>`;
}

function loadPinit() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.querySelector('script[src*="assets.pinterest.com/js/pinit"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = 'https://assets.pinterest.com/js/pinit.js';
  document.body.appendChild(script);
}

/**
 * Official platform embed only — never a downloaded or rehosted file.
 * Native opens the public post URL; web uses the markup the platform returned.
 */
export function OfficialEmbed({ clip, height = 420 }: { clip: JourneyClip; height?: number }) {
  useEffect(() => {
    if (clip.platform === 'pinterest') loadPinit();
  }, [clip.platform]);

  if (clip.platform === 'youtube' && clip.youtubeVideoId && Platform.OS === 'web') {
    return (
      <View style={{ borderRadius: radii.card, overflow: 'hidden', height: 200 }}>
        {createElement('iframe', {
          src: `https://www.youtube.com/embed/${clip.youtubeVideoId}?autoplay=1`,
          style: { width: '100%', height: 200, border: 0 },
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowFullScreen: true,
        })}
      </View>
    );
  }

  if (Platform.OS === 'web' && clip.platform === 'pinterest' && clip.sourceUrl) {
    return (
      <View style={{ minHeight: 180 }}>
        {createElement('a', {
          href: clip.sourceUrl,
          'data-pin-do': 'embedPin',
          'data-pin-width': 'medium',
        })}
      </View>
    );
  }

  if (Platform.OS === 'web' && clip.embedHtml) {
    return (
      <View style={{ borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.ink, height }}>
        {createElement('iframe', {
          srcDoc: srcDoc(clip.embedHtml),
          style: { width: '100%', height, border: 0, background: '#000' },
          allow: 'encrypted-media; picture-in-picture; fullscreen',
          sandbox: 'allow-scripts allow-same-origin allow-popups allow-presentation',
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
