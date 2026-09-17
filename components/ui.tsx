import type { ComponentType, ReactNode } from 'react';
import {
  Image,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, elevation, fonts, radii } from '@/constants/theme';
import {
  ArrowFatUp,
  CaretRight,
  Check as CheckIcon,
  categoryIcon,
  ChatCircle,
  Info,
  Quotes,
  SealCheck,
  User as UserIcon,
} from '@/components/icons';
import { badgeTone, type ConfidenceBreakdown, scoreLabel } from '@/lib/confidence';
import { authorAvatar, initials } from '@/lib/catalog';
import type { CommunityPost, ProductCategory } from '@/lib/types';

type Level = 'flat' | 'raised' | 'lifted';

export function Card({
  children,
  style,
  level = 'flat',
  ...rest
}: ViewProps & { level?: Level }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radii.card,
          padding: 14,
        },
        elevation[level],
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Eyebrow({ children, color = colors.inkSoft }: { children: string; color?: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.semibold,
        fontSize: 10,
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </Text>
  );
}

export function Heading({
  children,
  size = 21,
  color = colors.ink,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: fonts.semibold,
          fontSize: size,
          letterSpacing: size > 24 ? -0.9 : -0.4,
          color,
          lineHeight: size * 1.18,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, color = colors.inkSoft }: { children: ReactNode; color?: string }) {
  return (
    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color }}>{children}</Text>
  );
}

export function Caption({ children, color = colors.inkSoft }: { children: ReactNode; color?: string }) {
  return (
    <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color }}>{children}</Text>
  );
}

export function Title({ children, color = colors.ink }: { children: ReactNode; color?: string }) {
  return (
    <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color, letterSpacing: -0.1 }}>
      {children}
    </Text>
  );
}

/**
 * Section heading with an optional trailing action. Keeping this in one place
 * means the scan order down a screen stays consistent everywhere.
 */
export function SectionHeader({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Heading size={16}>{title}</Heading>
        {hint ? <Caption>{hint}</Caption> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`${actionLabel} — ${title}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.rosewood }}>
            {actionLabel}
          </Text>
          <CaretRight size={12} color={colors.rosewood} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

type BtnKind = 'primary' | 'outline' | 'text' | 'quiet';

export function Button({
  label,
  kind = 'primary',
  icon: IconCmp,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  kind?: BtnKind;
  icon?: ComponentType<{ size?: number; color?: string; weight?: never | 'regular' | 'bold' | 'fill' }>;
  style?: StyleProp<ViewStyle>;
}) {
  const background =
    kind === 'primary' ? colors.rosewood : kind === 'quiet' ? colors.white : 'transparent';
  const textColor =
    kind === 'primary' ? colors.white : kind === 'text' ? colors.rosewood : colors.ink;
  const borderWidth = kind === 'outline' || kind === 'quiet' ? 1.5 : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(rest.disabled) }}
      style={[
        {
          backgroundColor: background,
          borderRadius: radii.button,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth,
          borderColor: colors.mist,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: rest.disabled ? 0.45 : 1,
        },
        kind === 'primary' && !rest.disabled ? elevation.raised : null,
        style,
      ]}
      {...rest}
    >
      {IconCmp ? <IconCmp size={17} color={textColor} weight="bold" /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: textColor, letterSpacing: -0.1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon: IconCmp,
}: {
  label: string;
  tone?: 'sage' | 'honey' | 'neutral' | 'rose' | 'ink';
  icon?: ComponentType<{ size?: number; color?: string; weight?: never | 'regular' | 'bold' | 'fill' }>;
}) {
  const map = {
    sage: { bg: colors.sageSoft, fg: colors.sage },
    honey: { bg: colors.honeySoft, fg: '#8A6A1C' },
    rose: { bg: colors.rosewoodSoft, fg: colors.rosewood },
    neutral: { bg: colors.mist, fg: colors.inkSoft },
    ink: { bg: 'rgba(42,33,29,0.72)', fg: colors.white },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: map.bg,
        borderRadius: radii.chip,
        paddingHorizontal: IconCmp ? 7 : 8,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {IconCmp ? <IconCmp size={11} color={map.fg} weight="fill" /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: map.fg }}>{label}</Text>
    </View>
  );
}

/** The one place "verified owner" is rendered, so it always looks the same. */
export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return <Badge label={compact ? 'Verified' : 'Verified owner'} tone="sage" icon={SealCheck} />;
}

export function ScoreBadge({ breakdown }: { breakdown: ConfidenceBreakdown }) {
  const tone = badgeTone(breakdown);
  const label =
    breakdown.tooFewReviews || breakdown.compositeScore == null
      ? scoreLabel(null, true)
      : `${scoreLabel(breakdown.compositeScore, false)} · ${breakdown.compositeScore}`;
  return <Badge label={label} tone={tone} />;
}

export function Chip({
  label,
  selected,
  onPress,
  icon: IconCmp,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentType<{ size?: number; color?: string; weight?: never | 'regular' | 'bold' | 'fill' }>;
}) {
  const fg = selected ? colors.rosewood : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      style={{
        borderRadius: radii.chip,
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: selected ? colors.rosewood : colors.mist,
        backgroundColor: selected ? colors.rosewoodSoft : colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {IconCmp ? <IconCmp size={13} color={fg} weight={selected ? 'fill' : 'regular'} /> : null}
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: fg }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Product thumbnail. Real product photography when we have it, and a Phosphor
 * category mark when we don't — never a glyph pretending to be a picture.
 */
export function Thumb({
  imageUrl,
  category,
  size = 54,
  radius,
}: {
  imageUrl?: string | null;
  category?: ProductCategory;
  size?: number;
  radius?: number;
}) {
  const CategoryMark = categoryIcon(category ?? 'treatment');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? (size > 40 ? 12 : size / 2),
        backgroundColor: colors.mist,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <CategoryMark size={size * 0.42} color={colors.inkSoft} weight="regular" />
      )}
    </View>
  );
}

/**
 * A person. Real portrait where one exists, initials otherwise. Community
 * screens lean on this heavily — faces are what make the feed feel inhabited.
 */
export function Avatar({
  userId,
  name,
  uri,
  size = 36,
  verified = false,
}: {
  userId?: string;
  name?: string;
  uri?: string | null;
  size?: number;
  verified?: boolean;
}) {
  const source = uri ?? (userId ? authorAvatar(userId) : null);
  const label = name ? initials(name) : '';
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.rosewoodSoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {source ? (
          <Image source={{ uri: source }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : label ? (
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: size * 0.36,
              color: colors.rosewood,
            }}
          >
            {label}
          </Text>
        ) : (
          <UserIcon size={size * 0.5} color={colors.rosewood} weight="regular" />
        )}
      </View>
      {verified ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            borderRadius: 999,
            backgroundColor: colors.shell,
            padding: 1.5,
          }}
        >
          <SealCheck size={size * 0.36} color={colors.sage} weight="fill" />
        </View>
      ) : null}
    </View>
  );
}

export function Field({
  value,
  placeholder,
  onPress,
}: {
  value?: string;
  placeholder: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value || placeholder}
      style={{
        backgroundColor: colors.white,
        borderColor: colors.mist,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 14,
          color: value ? colors.ink : colors.inkSoft,
        }}
      >
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.honeySoft,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <Info size={15} color="#8A6A1C" weight="fill" />
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.regular,
          fontSize: compact ? 11 : 12,
          lineHeight: 17,
          color: colors.ink,
        }}
      >
        Not medical advice. Patch-test before first use — individual reactions vary.
      </Text>
    </View>
  );
}

export function Notice({
  children,
  quiet = false,
  icon: IconCmp,
}: {
  children: string;
  quiet?: boolean;
  icon?: ComponentType<{ size?: number; color?: string; weight?: never | 'regular' | 'bold' | 'fill' }>;
}) {
  return (
    <View
      style={{
        backgroundColor: quiet ? colors.white : colors.honeySoft,
        borderRadius: 12,
        padding: 12,
        borderWidth: quiet ? 1 : 0,
        borderColor: colors.mist,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {IconCmp ? (
        <IconCmp size={15} color={quiet ? colors.inkSoft : '#8A6A1C'} weight="regular" />
      ) : null}
      <Text
        style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.ink }}
      >
        {children}
      </Text>
    </View>
  );
}

function toneFor(score: number | null): string {
  if (score == null) return colors.inkSoft;
  if (score >= 80) return colors.sage;
  if (score >= 60) return colors.honey;
  return colors.rosewood;
}

export function ScoreRing({ score, size = 72 }: { score: number | null; size?: number }) {
  const ring = toneFor(score);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3.5,
        borderColor: score == null ? colors.mist : ring,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.3, color: colors.ink, letterSpacing: -0.5 }}>
        {score == null ? '—' : score}
      </Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 7.5, color: colors.inkSoft, letterSpacing: 0.7 }}>
        OUT OF 100
      </Text>
    </View>
  );
}

/**
 * The three parts of the Confidence Score, always shown alongside the number.
 * The score is never allowed to appear bare — a reader should come away with
 * "I understand why", not "I was told what to think".
 */
export function ScoreMeter({ breakdown }: { breakdown: ConfidenceBreakdown }) {
  const rows: { label: string; value: number | null; note: string }[] = [
    { label: 'Fit for your skin', value: breakdown.fitMatchScore, note: breakdown.fitLabel },
    { label: 'What owners report', value: breakdown.sentimentScore, note: breakdown.sentimentLabel },
    { label: 'Ingredient transparency', value: breakdown.transparencyScore, note: breakdown.transparencyLabel },
  ];
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row) => (
        <View key={row.label} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.ink }}>{row.label}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: toneFor(row.value) }}>
              {row.value == null ? 'Not scored' : row.value}
            </Text>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.mist, overflow: 'hidden' }}>
            <View
              style={{
                width: `${row.value ?? 0}%`,
                height: 5,
                borderRadius: 3,
                backgroundColor: toneFor(row.value),
              }}
            />
          </View>
          <Caption>{row.note}</Caption>
        </View>
      ))}
    </View>
  );
}

export function Check({ done, size = 24 }: { done: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: done ? colors.sage : colors.mist,
        backgroundColor: done ? colors.sage : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? <CheckIcon size={size * 0.55} color={colors.white} weight="bold" /> : null}
    </View>
  );
}

export function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Caption>{label}</Caption>
    </View>
  );
}

/**
 * A single community voice. Leads with the person, because peer authority is
 * what makes this more persuasive than a brand claim — you should see who is
 * talking before you read what they said.
 */
export function PostCard({
  post,
  onHelpful,
  voted,
  highlightQuestion,
  onPressAuthor,
}: {
  post: CommunityPost;
  onHelpful?: () => void;
  voted?: boolean;
  highlightQuestion?: boolean;
  onPressAuthor?: () => void;
}) {
  const isQuestion = post.type === 'question';
  const asked = highlightQuestion && isQuestion;
  return (
    <Card
      level="flat"
      style={
        asked
          ? { backgroundColor: colors.rosewoodSoft, borderColor: 'rgba(140,53,71,0.18)' }
          : undefined
      }
    >
      <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
        <Pressable
          onPress={onPressAuthor}
          disabled={!onPressAuthor}
          accessibilityRole={onPressAuthor ? 'link' : undefined}
          accessibilityLabel={onPressAuthor ? `${post.authorName}'s profile` : undefined}
        >
          <Avatar userId={post.userId} name={post.authorName} size={38} verified={post.isVerifiedOwner} />
        </Pressable>
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
              {post.authorName}
            </Text>
            {post.traitTags.slice(0, 2).map((tag) => (
              <Text key={tag} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft }}>
                {`· ${tag}`}
              </Text>
            ))}
          </View>

          {asked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ChatCircle size={12} color={colors.rosewood} weight="fill" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.rosewood, letterSpacing: 0.4 }}>
                ASKED THIS
              </Text>
            </View>
          ) : null}

          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink }}>
            {post.body}
          </Text>

          <Pressable
            onPress={onHelpful}
            disabled={!onHelpful || voted}
            hitSlop={6}
            accessibilityRole={onHelpful ? 'button' : undefined}
            accessibilityLabel={onHelpful ? 'Mark this as helpful' : undefined}
            accessibilityState={{ selected: Boolean(voted) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}
          >
            <ArrowFatUp
              size={13}
              color={voted ? colors.sage : colors.inkSoft}
              weight={voted ? 'fill' : 'regular'}
            />
            <Caption color={voted ? colors.sage : colors.inkSoft}>
              {`${post.helpfulCount + (voted ? 1 : 0)} found this helpful${onHelpful && !voted ? ' · tap if you did' : ''}`}
            </Caption>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

/** Typographic tile for a post with no photograph — honest, not a fake image. */
export function QuoteTile({ body, height }: { body: string; height: number }) {
  return (
    <View
      style={{
        height,
        backgroundColor: colors.rosewoodSoft,
        padding: 14,
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Quotes size={18} color={colors.rosewood} weight="fill" />
      <Text
        numberOfLines={4}
        style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink }}
      >
        {body}
      </Text>
    </View>
  );
}

export function Wordmark({ size = 21, color = colors.rosewood }: { size?: number; color?: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.bold,
        fontSize: size,
        color,
        letterSpacing: -0.7,
      }}
    >
      Sourced
    </Text>
  );
}
