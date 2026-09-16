import type { ReactNode } from 'react';
import { Image, Pressable, Text, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';
import { badgeTone, type ConfidenceBreakdown, scoreLabel } from '@/lib/confidence';
import type { CommunityPost } from '@/lib/types';

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radii.card,
          padding: 12,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.semibold,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: colors.inkSoft,
      }}
    >
      {children}
    </Text>
  );
}

export function Heading({
  children,
  size = 21,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <Text
      style={{
        fontFamily: fonts.semibold,
        fontSize: size,
        letterSpacing: -0.4,
        color: colors.ink,
        lineHeight: size * 1.2,
      }}
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

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, letterSpacing: -0.1 }}>
      {children}
    </Text>
  );
}

type BtnKind = 'primary' | 'outline' | 'text';

export function Button({
  label,
  kind = 'primary',
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  kind?: BtnKind;
  style?: StyleProp<ViewStyle>;
}) {
  const background =
    kind === 'primary' ? colors.rosewood : kind === 'outline' ? 'transparent' : 'transparent';
  const textColor = kind === 'primary' ? colors.white : kind === 'outline' ? colors.ink : colors.rosewood;
  const borderWidth = kind === 'outline' ? 1.5 : 0;
  return (
    <Pressable
      style={[
        {
          backgroundColor: background,
          borderRadius: radii.button,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderWidth,
          borderColor: colors.mist,
          alignItems: 'center',
          opacity: rest.disabled ? 0.5 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: textColor, letterSpacing: -0.1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'sage' | 'honey' | 'neutral' | 'rose';
}) {
  const map = {
    sage: { bg: colors.sageSoft, fg: colors.sage },
    honey: { bg: colors.honeySoft, fg: '#8A6A1C' },
    rose: { bg: colors.rosewoodSoft, fg: colors.rosewood },
    neutral: { bg: colors.mist, fg: colors.inkSoft },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: map.bg,
        borderRadius: radii.chip,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: map.fg }}>{label}</Text>
    </View>
  );
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
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: radii.chip,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: selected ? colors.rosewood : colors.mist,
        backgroundColor: selected ? colors.rosewoodSoft : colors.white,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 12,
          color: selected ? colors.rosewood : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Thumb({
  emoji,
  size = 52,
  imageUrl,
}: {
  emoji: string;
  size?: number;
  imageUrl?: string | null;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? 10 : size / 2,
        backgroundColor: colors.mist,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size > 40 ? 18 : 14 }}>{emoji}</Text>
      )}
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
      }}
    >
      <Text
        style={{
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

export function Notice({ children, quiet = false }: { children: string; quiet?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: quiet ? colors.white : colors.honeySoft,
        borderRadius: 12,
        padding: 12,
        borderWidth: quiet ? 1 : 0,
        borderColor: colors.mist,
      }}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.ink }}>
        {children}
      </Text>
    </View>
  );
}

export function ScoreRing({ score }: { score: number | null }) {
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: score == null ? colors.mist : colors.sage,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>
        {score == null ? '—' : score}
      </Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 8, color: colors.inkSoft, letterSpacing: 0.6 }}>
        SCORE
      </Text>
    </View>
  );
}

export function Check({ done }: { done: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: done ? colors.sage : colors.mist,
        backgroundColor: done ? colors.sage : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? (
        <Text style={{ color: colors.white, fontSize: 12, fontFamily: fonts.bold }}>✓</Text>
      ) : null}
    </View>
  );
}

export function PostCard({
  post,
  onHelpful,
  voted,
  highlightQuestion,
}: {
  post: CommunityPost;
  onHelpful?: () => void;
  voted?: boolean;
  highlightQuestion?: boolean;
}) {
  const isQuestion = post.type === 'question';
  return (
    <Card
      style={
        highlightQuestion && isQuestion
          ? { backgroundColor: colors.rosewoodSoft, borderColor: colors.rosewoodSoft }
          : undefined
      }
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Thumb emoji={isQuestion ? '💬' : '👤'} size={34} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {post.isVerifiedOwner ? <Badge label="✓ Verified" tone="sage" /> : null}
            {isQuestion ? <Badge label="Question" tone="rose" /> : null}
            {post.traitTags.map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink }}>
            {post.body}
          </Text>
          <Pressable onPress={onHelpful} disabled={!onHelpful || voted}>
            <Caption color={voted ? colors.sage : colors.inkSoft}>
              {`↑ ${post.helpfulCount + (voted ? 1 : 0)} helpful${onHelpful ? ' · Reply' : ''}`}
            </Caption>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

export function Wordmark({ size = 21 }: { size?: number }) {
  return (
    <Text
      style={{
        fontFamily: fonts.bold,
        fontSize: size,
        color: colors.rosewood,
        letterSpacing: -0.6,
      }}
    >
      Sourced
    </Text>
  );
}
