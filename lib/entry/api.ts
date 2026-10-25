import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
export const categories = [
  "Skincare",
  "Body care",
  "Hair care",
  "Electronics",
  "Home essentials",
  "Food and drinks",
];
export type Setup = {
  interests: string[];
  sensitive_skin: boolean;
  onboarding_completed_at: string | null;
  skin_type: string | null;
};
export async function setup(): Promise<Setup | null> {
  const { data, error } = await db()
    .from("clarity_preferences")
    .select("interests,sensitive_skin,onboarding_completed_at,skin_type")
    .eq("user_id", await userId())
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveSetup(p: Partial<Setup>) {
  const { error } = await db()
    .from("clarity_preferences")
    .upsert({ ...p, user_id: await userId() });
  if (error) throw error;
}
export async function entrySeen() {
  return (await AsyncStorage.getItem("unmask-entry-seen")) === "yes";
}
export async function markEntrySeen() {
  await AsyncStorage.setItem("unmask-entry-seen", "yes");
}
export function safeReturn(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
    ? value
    : null;
}
let pending: { email: string; name: string } | null = null;
export function rememberName(email: string, name: string) {
  pending = { email, name };
}
export function takeName(email: string) {
  const name = pending?.email === email ? pending.name : "";
  pending = null;
  return name;
}
