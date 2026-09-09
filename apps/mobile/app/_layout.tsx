import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStoreProvider } from "@/src/store/AppStore";
import { I18nProvider } from "@/src/i18n";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppStoreProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppStoreProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
