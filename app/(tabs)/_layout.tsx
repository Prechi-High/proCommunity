import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { House, Package, Play, Plus, User } from '@/components/icons';
import { CreateSheet } from '@/components/unmask-ui';
import { colors, elevation, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [create, setCreate] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandDeep,
          tabBarInactiveTintColor: colors.bone3,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            height: 64 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(10, insets.bottom),
          },
          tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.1 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, focused }) => (
              <House size={22} color={String(color)} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="unmask"
          options={{
            title: 'Unmask',
            tabBarIcon: ({ color, focused }) => (
              <Play size={22} color={String(color)} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'Product',
            tabBarIcon: ({ color, focused }) => (
              <Package size={22} color={String(color)} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="you"
          options={{
            title: 'You',
            tabBarIcon: ({ color, focused }) => (
              <User size={22} color={String(color)} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen name="pulse" options={{ href: null }} />
        <Tabs.Screen name="saved" options={{ href: null }} />
      </Tabs>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share what happened, ask, or track a product"
        onPress={() => {
          hapticSelect();
          setCreate(true);
        }}
        style={{
          position: 'absolute',
          right: 18,
          bottom: 70 + insets.bottom,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: colors.brandDeep,
          alignItems: 'center',
          justifyContent: 'center',
          ...elevation.fab,
        }}
      >
        <Plus size={24} color={colors.white} weight="bold" />
      </Pressable>
      <CreateSheet open={create} onClose={() => setCreate(false)} />
    </View>
  );
}
