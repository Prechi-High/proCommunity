import { ArrowLeft } from "@/components/icons";
import type { ReactNode } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { fonts } from "@/constants/theme";
import { ink } from "@/components/unmask/reference/ui";
export function EntryPage({
  children,
  back = false,
}: {
  children: ReactNode;
  back?: boolean;
}) {
  const r = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 24,
            gap: 24,
            width: "100%",
            maxWidth: 580,
            alignSelf: "center",
            paddingBottom: 48,
            flexGrow: 1,
          }}
        >
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              minHeight: 46,
            }}
          >
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() =>
                  r.canGoBack() ? r.back() : r.replace("/welcome")
                }
                style={{ position: "absolute", left: 0, padding: 12 }}
              >
                <ArrowLeft size={23} color={ink.text} />
              </Pressable>
            ) : null}
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 30,
                color: ink.deep,
              }}
            >
              Unmask
            </Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function EntryTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fonts.serifBold,
        fontSize: 34,
        lineHeight: 40,
        letterSpacing: -1,
        color: ink.deep,
        marginTop: 16,
      }}
    >
      {children}
    </Text>
  );
}
