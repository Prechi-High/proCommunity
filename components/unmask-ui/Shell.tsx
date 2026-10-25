import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'react-native';

import { ArrowLeft, Bell } from '@/components/icons';
import { brandAssets } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';

export function AppShell({
  children,
  title,
  serif,
  subtitle,
  back,
  notify,
  footer,
  scroll = true,
  flush,
}: {
  children: ReactNode;
  title?: string;
  serif?: boolean;
  subtitle?: string;
  back?: boolean;
  notify?: boolean;
  footer?: ReactNode;
  scroll?: boolean;
  flush?: boolean;
}) {
  const router = useRouter();
  const header = (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: title ? 8 : 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        {back ? (
          <Pressable
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
        ) : (
          <Image source={brandAssets.wordmarkInk} style={{ width: 96, height: 24 }} resizeMode="contain" accessibilityLabel="Unmask" />
        )}
        {notify ? (
          <Pressable
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <Bell size={22} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
      {title ? (
        <View style={{ gap: 6, paddingTop: 8, paddingBottom: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: serif ? fonts.serifBold : fonts.semibold,
              fontSize: serif ? 32 : 22,
              lineHeight: serif ? 36 : 28,
              color: colors.ink,
              letterSpacing: serif ? -0.6 : -0.2,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, width: "100%", maxWidth: 820, alignSelf: "center", backgroundColor: colors.white }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: flush ? 0 : 20,
              paddingBottom: footer ? 32 : 120,
              gap: flush ? 0 : 24,
            }}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: flush ? 0 : 20 }}>{children}</View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Platform.OS === 'web' ? 16 : 10,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              backgroundColor: colors.white,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
