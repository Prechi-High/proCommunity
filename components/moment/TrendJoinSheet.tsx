import { Pressable, Text, View } from "react-native";

import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { SAMPLE_TRENDS } from "@/lib/moment/creatorCatalog";
import { momentFlow } from "@/lib/moment/flowTheme";
export function TrendJoinSheet({
  open,
  onClose,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  onJoin: (trend: (typeof SAMPLE_TRENDS)[number]) => void;
}) {
  return (
    <ActionSheet open={open} title="Join a trend" onClose={onClose}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted, marginBottom: 12 }}>
        Trends preload sound, look, and moment type — your Unmask stays normal content with a trend link.
      </Text>
      {SAMPLE_TRENDS.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => {
            hapticSelect();
            onJoin(t);
            onClose();
          }}
          style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft, gap: 4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: momentFlow.ink }}>{t.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{t.prompt}</Text>
        </Pressable>
      ))}
    </ActionSheet>
  );
}