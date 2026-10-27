import { useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Avatar, ActionButton } from "@/components/unmask-ui";
import { Plus } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
export function ReplyComposer({
  name,
  body,
  onChange,
  onSend,
  pending,
  attachment,
  hasAttachment = false,
}: {
  name: string;
  body: string;
  onChange: (v: string) => void;
  onSend: () => void;
  pending: boolean;
  attachment: ReactNode;
  hasAttachment?: boolean;
}) {
  const [focused, setFocused] = useState(false),
    [attach, setAttach] = useState(false);
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: colors.line,
        paddingTop: 18,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Avatar name={name} size={38} />
        <View style={{ flex: 1, gap: 10 }}>
          <TextInput
            accessibilityLabel="Post your reply"
            value={body}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            multiline
            maxLength={4000}
            placeholder="Post your reply…"
            placeholderTextColor={colors.inkSoft}
            editable={!pending}
            style={{
              minHeight: focused || body ? 110 : 50,
              paddingTop: 8,
              fontFamily: fonts.regular,
              fontSize: 18,
              lineHeight: 27,
              color: colors.ink,
              textAlignVertical: "top",
            }}
          />
          {focused || body || attach || hasAttachment ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTopWidth: 1,
                  borderColor: colors.line,
                  paddingTop: 10,
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Attach a product experience or timeline to my reply"
                  accessibilityState={{ expanded: attach }}
                  onPress={() => setAttach(!attach)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    minHeight: 44,
                    paddingRight: 10,
                  }}
                >
                  <Plus size={20} color={colors.brandDeep} />
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      color: colors.brandDeep,
                    }}
                  >
                    {hasAttachment ? "Attached experience" : "Experience"}
                  </Text>
                </Pressable>
                <ActionButton
                  label="Reply"
                  pending={pending}
                  pendingLabel="Sending…"
                  disabled={!body.trim()}
                  onPress={onSend}
                />
              </View>
            </>
          ) : null}
        </View>
      </View>
      {attach || hasAttachment ? attachment : null}
    </View>
  );
}
