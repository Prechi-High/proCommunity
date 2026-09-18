import { createElement, useEffect, useId, useRef, useState, type MutableRefObject } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { ArrowSquareOut } from '@/components/icons';
import { colors, radii } from '@/constants/theme';
import { officialEmbedHeight, officialEmbedSrc, youtubeIdFromUrl } from '@/lib/embedUrls';
import { loadMyVideoVote, platformLabel, submitVideoVote, voterKeyFor, type JourneyClip } from '@/lib/videos';

type YtPlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  destroy?: () => void;
};

type YtNamespace = {
  Player: new (id: string, opts: Record<string, unknown>) => YtPlayer;
  PlayerState: { ENDED: number };
};

type YtWindow = Window & {
  YT?: YtNamespace;
  onYouTubeIframeAPIReady?: () => void;
  __sourcedYtReady?: Array<() => void>;
};

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

function HelpfulPrompt({
  compact,
  onVote,
}: {
  compact?: boolean;
  onVote: (helpful: boolean) => void;
}) {
  return (
    <View style={{ gap: compact ? 6 : 10, alignItems: compact ? 'stretch' : 'center' }}>
      <Text style={{ color: compact ? colors.ink : colors.white, fontSize: compact ? 13 : 16, fontWeight: '600' }}>
        Was this helpful?
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => onVote(true)}
          accessibilityRole="button"
          accessibilityLabel="Yes, this was helpful"
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: compact ? colors.rosewoodSoft : colors.white,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.rosewood, fontWeight: '700' }}>Yes</Text>
        </Pressable>
        <Pressable
          onPress={() => onVote(false)}
          accessibilityRole="button"
          accessibilityLabel="No, this was not helpful"
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: compact ? colors.mist : '#ffffff88',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: compact ? colors.ink : colors.white, fontWeight: '700' }}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function useExistingVote(videoId: string, voterKey: string) {
  const [vote, setVote] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadMyVideoVote(videoId, voterKey).then((value) => {
      if (!cancelled) setVote(value);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId, voterKey]);
  const persist = async (helpful: boolean) => {
    setVote(helpful);
    await submitVideoVote(videoId, voterKey, helpful);
  };
  return { vote, persist };
}

function YouTubeApiPlayer({
  videoId,
  title,
  height,
  onEnded,
  replayRef,
}: {
  videoId: string;
  title: string;
  height: number;
  onEnded: () => void;
  replayRef: MutableRefObject<(() => void) | null>;
}) {
  const hostId = `yt${useId().replace(/:/g, '')}`;
  const playerRef = useRef<YtPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let destroyed = false;
    const w = window as YtWindow;

    const start = () => {
      if (destroyed || !w.YT?.Player) return;
      const player = new w.YT.Player(hostId, {
        height: String(height),
        width: '100%',
        videoId,
        playerVars: {
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onStateChange: (event: { data: number }) => {
            if (event.data === w.YT?.PlayerState.ENDED) onEndedRef.current();
          },
        },
      });
      playerRef.current = player;
      replayRef.current = () => {
        player.seekTo(0, true);
        player.playVideo();
      };
    };

    if (w.YT?.Player) {
      start();
    } else {
      w.__sourcedYtReady = w.__sourcedYtReady ?? [];
      w.__sourcedYtReady.push(start);
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        const queued = w.__sourcedYtReady ?? [];
        w.__sourcedYtReady = [];
        queued.forEach((fn) => fn());
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
    }

    return () => {
      destroyed = true;
      replayRef.current = null;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Player DOM may already be gone.
      }
      playerRef.current = null;
    };
  }, [videoId, height, hostId, replayRef]);

  return createElement('div', {
    id: hostId,
    title,
    style: { width: '100%', height, background: '#000' },
  });
}

function VoteDock({
  vote,
  persist,
  overlay,
  onReplay,
}: {
  vote: boolean | null;
  persist: (helpful: boolean) => Promise<void>;
  overlay?: boolean;
  onReplay?: () => void;
}) {
  if (vote != null && !onReplay) return null;
  if (vote != null && onReplay) {
    return overlay ? (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(18, 12, 14, 0.82)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={onReplay} accessibilityRole="button" accessibilityLabel="Replay video">
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: 16 }}>Replay</Text>
        </Pressable>
      </View>
    ) : null;
  }
  return (
    <View
      style={
        overlay
          ? {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(18, 12, 14, 0.82)',
              justifyContent: 'center',
              padding: 18,
              gap: 14,
            }
          : {
              paddingTop: 8,
              paddingBottom: 2,
            }
      }
    >
      <HelpfulPrompt compact={!overlay} onVote={persist} />
      {onReplay ? (
        <Pressable onPress={onReplay} accessibilityRole="button" accessibilityLabel="Replay video">
          <Text
            style={{
              color: overlay ? colors.white : colors.rosewood,
              fontWeight: '700',
              textAlign: 'center',
              paddingVertical: 6,
            }}
          >
            Replay
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Official platform players only. Instagram must run embed.js on the host page;
 * a nested srcDoc/iframe copy is what produced the login wall.
 *
 * YouTube (web): IFrame Player API, helpful overlay on ENDED, Replay via seekTo.
 * Other platforms: docked Yes/No on our chrome. Duration overlay is an
 * approximation from oEmbed seconds — never claimed as true end detection.
 */
export function OfficialEmbed({
  clip,
  height,
  voterKey,
}: {
  clip: JourneyClip;
  height?: number;
  voterKey?: string;
}) {
  const key = voterKey || voterKeyFor();
  const youtubeId = clip.youtubeVideoId || youtubeIdFromUrl(clip.sourceUrl);
  const src = officialEmbedSrc(clip.platform, clip.sourceUrl, youtubeId);
  const frameHeight = height ?? officialEmbedHeight(clip.platform);
  const replayRef = useRef<(() => void) | null>(null);
  const [youtubeEnded, setYoutubeEnded] = useState(false);
  const [approxEnded, setApproxEnded] = useState(false);
  const { vote, persist } = useExistingVote(clip.id, key);

  useEffect(() => {
    if (Platform.OS === 'web' && clip.platform === 'instagram' && clip.sourceUrl) {
      loadInstagramEmbed(clip.sourceUrl);
    }
  }, [clip.platform, clip.sourceUrl]);

  useEffect(() => {
    setYoutubeEnded(false);
    setApproxEnded(false);
    if (clip.platform === 'youtube' || !clip.durationSeconds || clip.durationSeconds <= 0) return undefined;
    const timer = setTimeout(() => setApproxEnded(true), clip.durationSeconds * 1000);
    return () => clearTimeout(timer);
  }, [clip.id, clip.platform, clip.durationSeconds]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ gap: 8 }}>
        <WatchOnPlatform clip={clip} />
        <VoteDock vote={vote} persist={persist} />
      </View>
    );
  }

  if (clip.platform === 'youtube' && youtubeId) {
    return (
      <View style={{ gap: 8 }}>
        <View
          style={{
            borderRadius: radii.card,
            overflow: 'hidden',
            backgroundColor: colors.ink,
            height: frameHeight,
            position: 'relative',
          }}
        >
          <YouTubeApiPlayer
            videoId={youtubeId}
            title={clip.title || 'YouTube'}
            height={frameHeight}
            onEnded={() => setYoutubeEnded(true)}
            replayRef={replayRef}
          />
          {youtubeEnded ? (
            <VoteDock
              vote={vote}
              persist={persist}
              overlay
              onReplay={() => {
                replayRef.current?.();
                setYoutubeEnded(false);
              }}
            />
          ) : null}
        </View>
      </View>
    );
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
        <VoteDock vote={vote} persist={persist} />
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
            position: 'relative',
          }}
        >
          <PlatformIframe src={src} title={clip.title || platformLabel(clip.platform)} height={frameHeight} />
          {approxEnded && vote == null ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 12,
                backgroundColor: 'rgba(18, 12, 14, 0.78)',
              }}
            >
              <HelpfulPrompt compact onVote={persist} />
            </View>
          ) : null}
        </View>
        {!(approxEnded && vote == null) ? <VoteDock vote={vote} persist={persist} /> : null}
        <WatchOnPlatform clip={clip} />
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <WatchOnPlatform clip={clip} />
      <VoteDock vote={vote} persist={persist} />
    </View>
  );
}
