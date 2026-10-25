import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, elevation } from "@/constants/theme";

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
    backgroundColor: colors.white,
    paddingHorizontal: padded ? 20 : 0,
    paddingTop: 4,
  };
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.white }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[
              { ...bodyStyle, flex: undefined },
              { flexGrow: 1, paddingBottom: footer ? 24 : 32 },
            ]}
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
              paddingBottom: Platform.OS === "web" ? 14 : 8,
              paddingTop: 12,
              backgroundColor: colors.white,
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
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        backgroundColor: "#F0EDE9",
        alignItems: "center",
      }}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1040,
          backgroundColor: colors.white,
          overflow: "hidden",
          ...elevation.lifted,
        }}
      >
        {children}
      </View>
    </View>
  );
}
