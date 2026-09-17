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
    backgroundColor: colors.shell,
    paddingHorizontal: padded ? 16 : 0,
    paddingTop: 4,
    gap: 14,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.shell }} edges={['top']}>
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
              paddingBottom: Platform.OS === 'web' ? 16 : 8,
              paddingTop: 10,
              backgroundColor: colors.shell,
              borderTopWidth: 1,
              borderTopColor: colors.mist,
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
    return <View style={{ flex: 1, backgroundColor: colors.shell }}>{children}</View>;
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#E8E2DC',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 430,
          backgroundColor: colors.shell,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
