import { Image, Modal, Pressable, Text, View } from 'react-native';

import { FocusFrame } from '@/components/brand/FocusFrame';
import { colors, fonts } from '@/constants/theme';
import { labelForStage, type ResearchStage } from '@/lib/research/overlayStages';

type Props = {
  visible: boolean;
  stage: ResearchStage;
  photoUri?: string | null;
  onCancel?: () => void;
  /** Full-screen modal vs inline block on product page */
  mode?: 'modal' | 'inline';
};

function Backdrop({ photoUri }: { photoUri?: string | null }) {
  if (photoUri) {
    return (
      <>
        <Image source={{ uri: photoUri }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(246,244,239,0.78)' }} />
      </>
    );
  }
  return <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.wine }} />;
}

function Body({ stage, photoUri, onCancel }: Omit<Props, 'visible' | 'mode'>) {
  const status = labelForStage(stage === 'idle' ? 'generic' : stage);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 }}>
      <Backdrop photoUri={photoUri} />
      <View style={{ alignItems: 'center', gap: 16, zIndex: 2 }}>
        <FocusFrame size={photoUri ? 132 : 148} active={stage !== 'idle'} uColor={colors.hi} color={colors.hi} />
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.bone, textAlign: 'center', maxWidth: 320 }}
        >
          {status}
        </Text>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ResearchOverlay({ visible, stage, photoUri, onCancel, mode = 'modal' }: Props) {
  if (!visible && mode === 'inline') return null;
  if (mode === 'inline') {
    return (
      <View style={{ minHeight: 360, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.wine }}>
        <Body stage={stage} photoUri={photoUri} onCancel={onCancel} />
      </View>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.wine }}>
        <Body stage={stage} photoUri={photoUri} onCancel={onCancel} />
      </View>
    </Modal>
  );
}
