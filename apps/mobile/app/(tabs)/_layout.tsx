import { Tabs } from "expo-router";
import React from "react";
import CustomTabBar from "@/components/navigation/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="hunts" />
      <Tabs.Screen name="forum" />
      <Tabs.Screen name="tracker" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="bestiary" options={{ href: null }} />
      <Tabs.Screen name="quest-board" options={{ href: null }} />
      <Tabs.Screen name="shop" options={{ href: null }} />
      <Tabs.Screen name="music" options={{ href: null }} />
      <Tabs.Screen name="streamers" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="streamers-services" options={{ href: null }} />
    </Tabs>
  );
}
