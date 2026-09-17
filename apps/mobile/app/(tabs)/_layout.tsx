import { Redirect, Tabs } from "expo-router";
import React from "react";
import CustomTabBar from "../../components/navigation/CustomTabBar";
import { useAuth } from "@/src/auth/AuthContext";

export default function TabsLayout() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) return null;
  if (!isAuthenticated) return <Redirect href={"/(auth)/login" as any} />;

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
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="tracker" options={{ href: null }} />
      <Tabs.Screen name="bestiary" options={{ href: null }} />
      <Tabs.Screen name="quest-board" options={{ href: null }} />
      <Tabs.Screen name="music" options={{ href: null }} />
      <Tabs.Screen name="streamers" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="streamers-services" options={{ href: null }} />
      <Tabs.Screen name="hunt/[id]" options={{ href: null }} />
    </Tabs>
  );
}
