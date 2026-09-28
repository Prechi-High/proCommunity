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
  CameraRotate,
  ImageSquare,
  UploadSimple,
  CaretRight,
  Cat,
  ChatCircle,
  ChatsCircle,
  Check,
  CheckCircle,
  Drop,
  Eyedropper,
  FacebookLogo,
  Flask,
  Flower,
  Handbag,
  HandHeart,
  Heart,
  House,
  Info,
  InstagramLogo,
  Leaf,
  Lightbulb,
  Lock,
  MagnifyingGlass,
  MoonStars,
  NotePencil,
  // Names that would collide with common globals ship with an `Icon` suffix.
  PathIcon as Path,
  PencilSimple,
  PinterestLogo,
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
  TiktokLogo,
  Trash,
  TrendUp,
  User,
  Warning,
  X,
  YoutubeLogo,
  Package,
  DeviceMobile,
  TShirt,
  ForkKnife,
  Wrench,
  Car,
  Star,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Clock,
  BookmarkSimple,
  Globe,
  ArrowClockwise,
  ListBullets,
  ArrowsLeftRight,
  Scan,
  RedditLogo,
  UsersThree,
  PaperPlaneRight,
  Fire,
  Eye,
  ChatTeardropText,
  Megaphone,
  Pulse,
  SmileyNervous,
  UserCircle,
  ArrowFatDown,
  BellRinging,
  ChatCircleDots,
  DotsThree,
  ImageSquare as ImageIcon,
  Lightning,
  Sparkle as SparkleIcon,
  Trophy,
  WhatsappLogo,
  Files,
  LinkSimple,
} from 'phosphor-react-native';

export {
  WhatsappLogo,
  Files,
  LinkSimple,
  ArrowFatDown,
  BellRinging,
  ChatCircleDots,
  DotsThree,
  ImageIcon,
  Lightning,
  SparkleIcon,
  Trophy,
  RedditLogo,
  UsersThree,
  PaperPlaneRight,
  Fire,
  Eye,
  ChatTeardropText,
  Megaphone,
  Pulse,
  SmileyNervous,
  UserCircle,
  Package,
  DeviceMobile,
  TShirt,
  ForkKnife,
  Wrench,
  Car,
  Star,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Clock,
  BookmarkSimple,
  Globe,
  ArrowClockwise,
  ListBullets,
  ArrowsLeftRight,
  Scan,
};

import { colors } from '@/constants/theme';

export {
  ArrowFatUp,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Bell,
  BellSlash,
  BookOpen,
  Camera,
  CameraRotate,
  ImageSquare,
  UploadSimple,
  CaretRight,
  Cat,
  ChatCircle,
  ChatsCircle,
  Check,
  CheckCircle,
  Drop,
  Eyedropper,
  FacebookLogo,
  Flask,
  Flower,
  Handbag,
  HandHeart,
  Heart,
  House,
  Info,
  InstagramLogo,
  Leaf,
  Lightbulb,
  Lock,
  MagnifyingGlass,
  MoonStars,
  NotePencil,
  Path,
  PencilSimple,
  PinterestLogo,
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
  TiktokLogo,
  Trash,
  TrendUp,
  User,
  Warning,
  X,
  YoutubeLogo,
};

export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/** Product categories get a consistent icon so a list reads at a glance. */
const CATEGORY_ICONS: Array<[RegExp, typeof Package]> = [
  [/phone|charger|cable|laptop|computer|tablet|earbud|headphone|speaker|camera|tv|monitor|electronic|console|controller|watch/i, DeviceMobile],
  [/shoe|sneaker|shirt|dress|jacket|cloth|apparel|bag|fashion/i, TShirt],
  [/food|drink|snack|coffee|tea|beverage|grocery/i, ForkKnife],
  [/tool|drill|hardware|repair/i, Wrench],
  [/car|auto|tyre|tire|vehicle/i, Car],
  [/home|kitchen|blender|appliance|furniture|lamp/i, House],
  [/beauty|cosmetic|skin|hair|fragrance|makeup/i, Drop],
];

export function categoryIcon(category: string) {
  return CATEGORY_ICONS.find(([re]) => re.test(category))?.[1] ?? Package;
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
