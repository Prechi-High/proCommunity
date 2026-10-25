import { useReducedMotion } from "react-native-reanimated";
import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { X } from "@/components/icons";
import { colors, elevation, fonts, radii } from "@/constants/theme";

export function ActionSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={open}
      animationType={reduced ? "none" : "slide"}
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(28,25,23,0.42)",
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={{
            backgroundColor: colors.white,
            maxHeight: "90%",
            width: "100%",
            maxWidth: 620,
            alignSelf: "center",
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(24, insets.bottom + 16),
            gap: 16,
            ...elevation.lifted,
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.line,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 26,
                lineHeight: 30,
                color: colors.ink,
                flex: 1,
                letterSpacing: -0.4,
              }}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.mist,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
