import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand/Wordmark';
import { ArrowLeft, BookmarkSimple, ShareNetwork } from '@/components/icons';
import { colors } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';

type Props = {
  onBack: () => void;
  saved?: boolean;
  onSave?: () => void;
  onShare?: () => void;
  children?: ReactNode;
};

export function ProductScreenChrome({ onBack, saved, onSave, onShare, children }: Props) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.wine }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}>
        <Pressable
          onPress={() => {
            hapticTap();
            onBack();
          }}
          hitSlop={10}
          accessibilityLabel="Back"
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.brand} weight="bold" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Wordmark height={26} tone="ink" />
        </View>
        <Pressable
          onPress={() => onShare?.()}
          hitSlop={10}
          accessibilityLabel="Share"
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <ShareNetwork size={20} color={colors.brand} weight="bold" />
        </Pressable>
        <Pressable
          onPress={() => onSave?.()}
          hitSlop={10}
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <BookmarkSimple size={20} color={colors.brand} weight={saved ? 'fill' : 'regular'} />
        </Pressable>
      </View>
      {children}
    </SafeAreaView>
  );
}
