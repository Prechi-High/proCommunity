import { Image, Pressable, Text, View } from "react-native";

import { Camera, MagnifyingGlass, Package, SealCheck } from "@/components/icons";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";

const DEMO_PRODUCT = {
  name: "CeraVe Foaming Cleanser",
  detail: "236ml • Cleanser",
  image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=80",
};

export function AddProductSheet({
  open,
  onClose,
  selectedName,
  onSelectDemo,
}: {
  open: boolean;
  onClose: () => void;
  selectedName?: string;
  onSelectDemo: () => void;
}) {
  const picked = selectedName === DEMO_PRODUCT.name;
  return (
    <ActionSheet open={open} title="Add a Product" onClose={onClose}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted, marginBottom: 16 }}>
        Quickly add what you&apos;re using in this Unmask.
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Show me", sub: "Take a photo of the product", Icon: Camera },
          { label: "Find it", sub: "Search by name or brand", Icon: MagnifyingGlass },
          { label: "From my products", sub: "Pick from what you already use", Icon: Package },
        ].map(({ label, sub, Icon }) => (
          <Pressable
            key={label}
            onPress={() => {
              hapticSelect();
              if (label === "From my products") onSelectDemo();
            }}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 16,
              backgroundColor: momentFlow.pillPink,
              gap: 8,
              minHeight: 120,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: momentFlow.card, alignItems: "center", justifyContent: "center" }}>
              <Icon size={22} color={momentFlow.accent} />
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.ink }}>{label}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: momentFlow.muted }}>{sub}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => {
          hapticSelect();
          onSelectDemo();
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 16,
          backgroundColor: momentFlow.card,
          borderWidth: 1,
          borderColor: picked ? momentFlow.accent : momentFlow.accentSoft,
        }}
      >
        <Image source={{ uri: DEMO_PRODUCT.image }} style={{ width: 52, height: 52, borderRadius: 12 }} accessibilityIgnoresInvertColors />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>{DEMO_PRODUCT.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{DEMO_PRODUCT.detail}</Text>
        </View>
        {picked ? <SealCheck size={22} color={momentFlow.accent} weight="fill" /> : null}
      </Pressable>
      <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: momentFlow.warn, flexDirection: "row", gap: 10 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: momentFlow.warnInk }}>i</Text>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: momentFlow.warnInk }}>
          Verification not confirmed yet. You can confirm by taking a clear photo of the product later.
        </Text>
      </View>
      <Pressable
        onPress={() => {
          hapticSelect();
          onSelectDemo();
          onClose();
        }}
        style={{ marginTop: 18, paddingVertical: 16, borderRadius: momentFlow.radiusPill, backgroundColor: momentFlow.accent, alignItems: "center" }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Add to my Unmask</Text>
      </Pressable>
    </ActionSheet>
  );
}