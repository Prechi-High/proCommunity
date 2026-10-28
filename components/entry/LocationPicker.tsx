import { useState } from "react";
import { Pressable, Text, View, FlatList } from "react-native";
import { countries, statesFor } from "@/lib/locations";
export { countries, statesFor } from "@/lib/locations";
import { ActionSheet, SearchField } from "@/components/unmask-ui";
import { CaretDown, MapPin } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
export function LocationPicker({
  country,
  region,
  onChange,
}: {
  country: string;
  region: string;
  onChange: (country: string, region: string) => void;
}) {
  const [open, setOpen] = useState<"country" | "region" | null>(null),
    [search, setSearch] = useState("");
  const states = statesFor(country),
    chosen = countries.find((c) => c.isoCode === country);
  const options = (open === "country" ? countries : states).filter((x) =>
    x.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <View style={{ gap: 14 }}>
      {[
        {
          type: "country" as const,
          label: chosen?.name || "Choose your country",
          disabled: false,
        },
        {
          type: "region" as const,
          label:
            region ||
            (!country
              ? "Choose a country first"
              : states.length
                ? "Choose your state / region"
                : "No state selection needed"),
          disabled: !states.length,
        },
      ].map((x) => (
        <Pressable
          key={x.type}
          accessibilityRole="button"
          accessibilityLabel={
            x.type === "country" ? "Country" : "State or region"
          }
          disabled={x.disabled}
          onPress={() => {
            setSearch("");
            setOpen(x.type);
          }}
          style={{
            padding: 17,
            minHeight: 58,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.line,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            opacity: x.disabled ? 0.55 : 1,
          }}
        >
          <MapPin size={21} color={colors.inkSoft} />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.medium,
              fontSize: 16,
              color: colors.ink,
            }}
          >
            {x.label}
          </Text>
          <CaretDown size={18} color={colors.inkSoft} />
        </Pressable>
      ))}
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 13,
          lineHeight: 20,
          color: colors.inkSoft,
        }}
      >
        Country and state only. We don’t need your address. These stay in your
        private account.
      </Text>
      <ActionSheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open === "country" ? "Your country" : "Your state / region"}
      >
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Find by name"
        />
        <FlatList
          style={{ maxHeight: 350 }}
          keyboardShouldPersistTaps="handled"
          data={options}
          keyExtractor={(x) => x.isoCode}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onChange(
                  open === "country" ? item.isoCode : country,
                  open === "country" ? "" : item.name,
                );
                setOpen(null);
              }}
              style={({ pressed }) => ({
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
                backgroundColor: pressed ? "#F4EBF0" : "#fff",
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 16,
                  color: colors.ink,
                }}
              >
                {item.name}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>No matching locations.</Text>}
        />
      </ActionSheet>
    </View>
  );
}
