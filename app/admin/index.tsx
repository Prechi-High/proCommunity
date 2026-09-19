import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import { OfficialEmbed } from '@/components/VideoEmbed';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  SectionHeader,
  Title,
} from '@/components/ui';
import {
  Check,
  FacebookLogo,
  InstagramLogo,
  PinterestLogo,
  ShieldCheck,
  TiktokLogo,
  Trash,
  Warning,
  YoutubeLogo,
} from '@/components/icons';
import { colors } from '@/constants/theme';
import {
  approveVideo,
  discoverVideosForProduct,
  listPendingVideos,
  refreshVideoDiscovery,
  rejectVideo,
  type PendingVideo,
} from '@/lib/discoverVideos';
import { communityPosts, products } from '@/lib/seed';
import { useAppStore } from '@/lib/store';
import { isVideoReviewEnabled, tagLabel } from '@/lib/taxonomy';
import { platformLabel, voterKeyFor, type JourneyClip, type VideoPlatform } from '@/lib/videos';

const PLATFORM_ICONS = {
  youtube: YoutubeLogo,
  tiktok: TiktokLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  pinterest: PinterestLogo,
} as const;

function asClip(row: PendingVideo): JourneyClip {
  const platform = row.source_platform as VideoPlatform;
  const tags = (row.content_tags ?? []).filter((tag): tag is JourneyClip['contentTags'][number] =>
    [
      'how_it_works',
      'how_to_use',
      'composition',
      'who_its_for',
      'results_over_time',
      'precautions',
      'comparisons',
    ].includes(tag),
  );
  return {
    id: row.id,
    platform,
    sourceUrl: row.source_url,
    embedHtml: row.embed_html,
    youtubeVideoId: row.youtube_video_id ?? null,
    title: row.title ?? 'Video',
    author: row.channel_or_author ?? '',
    thumbnailUrl: row.thumbnail_url ?? '',
    durationSeconds: row.duration_seconds,
    contentTags: tags,
    classificationConfidence: row.classification_confidence ?? null,
    classificationJustification: row.classification_justification ?? null,
    helpfulCount: 0,
    notHelpfulCount: 0,
    wilson: 0,
  };
}

function productContext(row: PendingVideo): string {
  const product = products.find((item) => item.id === row.product_id);
  if (product) return product.name;
  const query = row.search_query ?? '';
  const parts = query.split(':');
  if (parts[0] === 'web' && parts.length >= 3) {
    return parts.slice(2).join(':').replace(/^attr:/, '');
  }
  return row.attribute_tag ?? '';
}

export default function AdminScreen() {
  const profile = useAppStore((s) => s.profile);
  const flaggedPostIds = useAppStore((s) => s.flaggedPostIds);
  const resolveFlag = useAppStore((s) => s.resolveFlag);
  const userPosts = useAppStore((s) => s.userPosts);
  const queryClient = useQueryClient();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [discoverProductId, setDiscoverProductId] = useState(products[0]?.id);

  const pendingQuery = useQuery({
    queryKey: ['pending-videos'],
    queryFn: listPendingVideos,
    enabled: Boolean(profile?.isAdmin),
  });

  const reviewQuery = useQuery({
    queryKey: ['video-review-flag'],
    queryFn: isVideoReviewEnabled,
    enabled: Boolean(profile?.isAdmin),
  });

  const discover = useMutation({
    mutationFn: async () => {
      const product = products.find((item) => item.id === discoverProductId) ?? products[0];
      return discoverVideosForProduct(product);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-videos'] }),
  });

  const refresh = useMutation({
    mutationFn: () => refreshVideoDiscovery(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-videos'] }),
  });

  const moderate = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      if (action === 'approve') return approveVideo(id, profile?.id);
      return rejectVideo(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-videos'] }),
  });

  if (!profile?.isAdmin) {
    return <Redirect href="/(tabs)/you" />;
  }

  const flagged = [...communityPosts, ...userPosts].filter((post) =>
    flaggedPostIds.includes(post.id),
  );
  const pending = pendingQuery.data?.clips ?? [];
  const discoverResult = discover.data;
  const discoverPayload = (discoverResult?.data ?? null) as {
    inserted?: number;
    error?: string;
    hint?: string;
    provider?: string;
    searches_attempted?: number;
    candidates_rejected?: number;
    duplicates_skipped?: number;
  } | null;
  const discoverError =
    discoverResult?.error ??
    discoverPayload?.error ??
    discover.error?.message ??
    pendingQuery.data?.error;

  return (
    <Screen>
      <Heading size={21}>Moderation</Heading>
      <Caption>
        Flag medical claims and adverse-reaction posts. Serious reactions route to the merchant, not to
        us. Negative opinion is not a reason to remove a post.
      </Caption>

      <SectionHeader
        title="Video discovery"
        hint="Cache-first serving. Wilson score reorders visible rows; it is not the review gate. Pending rows stay on record."
      />

      {reviewQuery.data === false || reviewQuery.data == null ? (
        <Card style={{ gap: 6, backgroundColor: colors.rosewoodSoft }}>
          <Title>Review is off for testing</Title>
          <Caption>
            Pending rows are still visible to shoppers. Set VIDEO_REVIEW_ENABLED and
            app_flags.video_review_enabled to true before public users.
          </Caption>
        </Card>
      ) : (
        <Caption>Review is on. Shoppers only see approved clips. Wilson ranking is separate.</Caption>
      )}

      <Caption>
        YouTube-only discovery (Serper is off). Finds short YouTube clips and stores them on the product.
      </Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {products.slice(0, 6).map((product) => (
          <Chip
            key={product.id}
            label={product.name}
            selected={discoverProductId === product.id}
            onPress={() => setDiscoverProductId(product.id)}
          />
        ))}
      </View>
      <Button
        label={discover.isPending ? 'Searching…' : 'Find short videos'}
        disabled={discover.isPending}
        onPress={() => discover.mutate()}
      />
      <Button
        label={refresh.isPending ? 'Refreshing gaps…' : 'Refresh catalog gaps'}
        kind="quiet"
        disabled={refresh.isPending}
        onPress={() => refresh.mutate()}
      />
      {discoverError ? <Caption color={colors.rosewood}>{discoverError}</Caption> : null}
      {discover.data && !discoverError ? (
        <Caption>
          {`Inserted ${String(discoverPayload?.inserted ?? 0)} live clips via ${discoverPayload?.provider ?? 'serper'}. ${String(discoverPayload?.searches_attempted ?? 0)} searches, ${String(discoverPayload?.candidates_rejected ?? 0)} URLs rejected, ${String(discoverPayload?.duplicates_skipped ?? 0)} duplicates skipped.`}
        </Caption>
      ) : null}

      {pendingQuery.isLoading ? <ActivityIndicator color={colors.rosewood} /> : null}

      {pending.length === 0 && !pendingQuery.isLoading ? (
        <Card style={{ alignItems: 'center', gap: 7, paddingVertical: 22 }}>
          <ShieldCheck size={22} color={colors.sage} weight="regular" />
          <Title>No videos waiting</Title>
          <Body>Run a search above. New clips stay in this queue with their tags and justification.</Body>
        </Card>
      ) : (
        pending.map((row) => {
          const PlatformMark = PLATFORM_ICONS[row.source_platform] ?? YoutubeLogo;
          const needsLengthCheck =
            row.source_platform === 'facebook' && row.duration_seconds == null;
          const clip = asClip(row);
          return (
            <Card key={row.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {row.thumbnail_url ? (
                  <Image
                    source={{ uri: row.thumbnail_url }}
                    style={{ width: 64, height: 42, borderRadius: 8, backgroundColor: colors.mist }}
                  />
                ) : (
                  <PlatformMark size={22} color={colors.ink} weight="fill" />
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Title>{row.title || platformLabel(row.source_platform)}</Title>
                  <Caption>
                    {`${platformLabel(row.source_platform)}${productContext(row) ? ` · ${productContext(row)}` : ''}${row.channel_or_author ? ` · ${row.channel_or_author}` : ''}`}
                  </Caption>
                </View>
              </View>
              {needsLengthCheck ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Warning size={14} color={colors.honey} weight="fill" />
                  <Caption>
                    Facebook can be long-form. Length was not in the oEmbed response — check before
                    approving.
                  </Caption>
                </View>
              ) : null}
              {row.duration_seconds != null ? (
                <Caption>{`${Math.round(row.duration_seconds / 60)} min · from oEmbed, not a downloaded file`}</Caption>
              ) : null}
              {row.content_tags?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {row.content_tags.map((tag) => (
                    <Chip key={tag} label={tagLabel(tag)} />
                  ))}
                </View>
              ) : (
                <Caption>No tags (below confidence floor, or classifier skipped).</Caption>
              )}
              {row.classification_confidence != null ? (
                <Caption>{`Confidence ${row.classification_confidence.toFixed(2)}${row.classification_method ? ` · ${row.classification_method}` : ''}`}</Caption>
              ) : null}
              {row.classification_justification ? (
                <Caption>{row.classification_justification}</Caption>
              ) : null}
              {previewId === row.id ? (
                <OfficialEmbed clip={clip} height={360} voterKey={voterKeyFor(profile?.id)} />
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 110 }}>
                  <Button
                    label={previewId === row.id ? 'Hide preview' : 'Preview embed'}
                    kind="quiet"
                    onPress={() => setPreviewId((current) => (current === row.id ? null : row.id))}
                  />
                </View>
                <Pressable onPress={() => Linking.openURL(row.source_url)} hitSlop={8}>
                  <Caption color={colors.rosewood}>Open source</Caption>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Approve"
                    icon={Check}
                    disabled={moderate.isPending}
                    onPress={() => moderate.mutate({ id: row.id, action: 'approve' })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Reject"
                    kind="quiet"
                    icon={Trash}
                    disabled={moderate.isPending}
                    onPress={() => moderate.mutate({ id: row.id, action: 'reject' })}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}

      <SectionHeader title="Flagged posts" />

      {flagged.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 7, paddingVertical: 28 }}>
          <ShieldCheck size={25} color={colors.sage} weight="regular" />
          <Title>Post queue is clear</Title>
          <Body>Long-press a community post to flag it for review.</Body>
        </Card>
      ) : (
        flagged.map((post) => (
          <Card key={post.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar userId={post.userId} name={post.authorName} size={34} />
              <View style={{ flex: 1 }}>
                <Title>{post.authorName}</Title>
                <Caption>{post.type}</Caption>
              </View>
              <Warning size={17} color={colors.honey} weight="fill" />
            </View>
            <Body color={colors.ink}>{post.body}</Body>
            <Button label="Resolve" kind="quiet" icon={Check} onPress={() => resolveFlag(post.id)} />
          </Card>
        ))
      )}
    </Screen>
  );
}
