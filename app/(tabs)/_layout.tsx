import { Tabs } from "expo-router";
import { MainNav } from "@/components/unmask-ui/MainNav";
export default function TabLayout() {
  return (
    <Tabs tabBar={() => <MainNav />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="unmask" options={{ href: null }} />
      <Tabs.Screen name="products" />
      <Tabs.Screen name="you" />
      <Tabs.Screen name="pulse" options={{ href: null }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
    </Tabs>
  );
}
