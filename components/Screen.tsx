import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: ReactNode;
}) {
  const bodyStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.wine,
    paddingHorizontal: padded ? 20 : 0,
    paddingTop: 4,
    gap: 0,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[bodyStyle, { flexGrow: 1, paddingBottom: footer ? 24 : 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[bodyStyle, { paddingBottom: 16 }]}>{children}</View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: Platform.OS === 'web' ? 14 : 8,
              paddingTop: 12,
              backgroundColor: colors.wine,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              gap: 8,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function WebShell({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <View style={{ flex: 1, backgroundColor: colors.wine }}>{children}</View>;
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.stage,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 390,
          maxHeight: Platform.OS === 'web' ? ('min(844px, calc(100dvh - 32px))' as unknown as number) : undefined,
          backgroundColor: colors.wine,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? ({
                borderRadius: 44,
                marginVertical: 16,
                boxShadow: '0 0 0 8px #0b0407, 0 30px 80px rgba(0,0,0,0.6)',
              } as object)
            : null),
        }}
      >
        {children}
      </View>
    </View>
  );
}
