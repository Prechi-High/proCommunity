/**
 * The single icon surface for the whole app.
 *
 * Sourced uses Phosphor exclusively: line weight by default, filled only to
 * mark an active or completed state. Nothing else — no emoji, no glyph
 * characters standing in for icons. Screens import from here rather than from
 * `phosphor-react-native` directly so this rule stays enforceable.
 */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowFatUp,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Bell,
  BellSlash,
  BookOpen,
  Camera,
  CaretRight,
  Cat,
  ChatCircle,
  ChatsCircle,
  Check,
  CheckCircle,
  Drop,
  Eyedropper,
  Flask,
  Flower,
  Handbag,
  HandHeart,
  Heart,
  House,
  Info,
  Leaf,
  Lightbulb,
  Lock,
  MagnifyingGlass,
  MoonStars,
  NotePencil,
  // Names that would collide with common globals ship with an `Icon` suffix.
  PathIcon as Path,
  PencilSimple,
  Play,
  Plus,
  Question,
  Quotes,
  Scales,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  Storefront,
  Sun,
  Trash,
  TrendUp,
  User,
  Warning,
  X,
  YoutubeLogo,
} from 'phosphor-react-native';

import { colors } from '@/constants/theme';
import type { ProductCategory } from '@/lib/types';

export {
  ArrowFatUp,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Bell,
  BellSlash,
  BookOpen,
  Camera,
  CaretRight,
  Cat,
  ChatCircle,
  ChatsCircle,
  Check,
  CheckCircle,
  Drop,
  Eyedropper,
  Flask,
  Flower,
  Handbag,
  HandHeart,
  Heart,
  House,
  Info,
  Leaf,
  Lightbulb,
  Lock,
  MagnifyingGlass,
  MoonStars,
  NotePencil,
  Path,
  PencilSimple,
  Play,
  Plus,
  Question,
  Quotes,
  Scales,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  Storefront,
  Sun,
  Trash,
  TrendUp,
  User,
  Warning,
  X,
  YoutubeLogo,
};

export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/** Product categories get a consistent icon so a shelf reads at a glance. */
const CATEGORY_ICONS = {
  cleanser: Drop,
  serum: Eyedropper,
  moisturizer: Flower,
  spf: Sun,
  mask: Sparkle,
  essence: Flask,
  treatment: Flask,
} as const;

export function categoryIcon(category: ProductCategory) {
  return CATEGORY_ICONS[category] ?? Flask;
}

/**
 * Back affordance used on every pushed screen. Generous hit area, low visual
 * weight — leaving should never feel like the loudest thing on the page.
 */
export function BackButton({ onPress, label }: { onPress?: () => void; label?: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Go back'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.mist,
      }}
    >
      <ArrowLeft size={17} color={colors.ink} weight="bold" />
    </Pressable>
  );
}

/** A soft circular pad behind an icon. Used for status and empty states. */
export function IconBubble({
  children,
  size = 44,
  tone = 'mist',
  style,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: 'mist' | 'sage' | 'rose' | 'honey' | 'white';
  style?: StyleProp<ViewStyle>;
}) {
  const background = {
    mist: colors.mist,
    sage: colors.sageSoft,
    rose: colors.rosewoodSoft,
    honey: colors.honeySoft,
    white: colors.white,
  }[tone];
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
