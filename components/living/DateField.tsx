import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { colors as c } from "@/constants/theme";
import { Button, design } from "./ui";
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date(value ? `${value}T12:00:00` : Date.now());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const today = iso(new Date());
  return (
    <View style={{ gap: 8 }}>
      <Text style={design.small}>{label}</Text>
      <Button
        quiet
        label={value || "Choose start date"}
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(22,22,22,.35)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={[
              design.card,
              { width: "100%", maxWidth: 400, alignSelf: "center" },
            ]}
          >
            <View style={[design.row, { justifyContent: "space-between" }]}>
              <Button
                quiet
                label="‹"
                onPress={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              />
              <Text style={design.small}>
                {month.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Button
                quiet
                label="›"
                disabled={iso(month).slice(0, 7) >= today.slice(0, 7)}
                onPress={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <View
                  key={`weekday${i}`}
                  style={{
                    width: "14.285%",
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={design.small}>{d}</Text>
                </View>
              ))}
              {Array.from({ length: month.getDay() }, (_, i) => (
                <View key={`blank${i}`} style={{ width: "14.285%" }} />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const d = iso(
                  new Date(month.getFullYear(), month.getMonth(), i + 1),
                );
                return (
                  <Pressable
                    key={d}
                    accessibilityLabel={d}
                    disabled={d > today}
                    onPress={() => {
                      onChange(d);
                      setOpen(false);
                    }}
                    style={{
                      width: "14.285%",
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 22,
                      backgroundColor: d === value ? c.brand : c.white,
                      opacity: d > today ? 0.3 : 1,
                    }}
                  >
                    <Text
                      style={[
                        design.body,
                        { color: d === value ? c.white : c.ink },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Button
              quiet
              label="Not started yet"
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
            />
            <Button label="Close calendar" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
