import { Tabs } from 'expo-router';

import { ChatsCircle, House, MagnifyingGlass, User } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.bone,
        tabBarInactiveTintColor: colors.bone3,
        tabBarStyle: {
          backgroundColor: colors.wine,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 74,
          paddingTop: 9,
          paddingBottom: 13,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <MagnifyingGlass size={22} color={focused ? colors.hi : String(color)} weight={focused ? 'bold' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, focused }) => (
            <ChatsCircle size={22} color={focused ? colors.hi : String(color)} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Shelf',
          tabBarIcon: ({ color, focused }) => (
            <House size={22} color={focused ? colors.hi : String(color)} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={focused ? colors.hi : String(color)} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
    </Tabs>
  );
}
