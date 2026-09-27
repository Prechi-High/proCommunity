import { Tabs } from 'expo-router';

import { BookmarkSimple, MagnifyingGlass, Pulse, User } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.hi,
        tabBarInactiveTintColor: colors.bone3,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopColor: colors.line,
          height: 76,
          paddingTop: 8,
          paddingBottom: 14,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <MagnifyingGlass size={24} color={String(color)} weight={focused ? 'bold' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="pulse"
        options={{
          title: 'Pulse',
          tabBarIcon: ({ color, focused }) => <Pulse size={24} color={String(color)} weight={focused ? 'bold' : 'regular'} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, focused }) => (
            <BookmarkSimple size={24} color={String(color)} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => <User size={24} color={String(color)} weight={focused ? 'fill' : 'regular'} />,
        }}
      />
    </Tabs>
  );
}
