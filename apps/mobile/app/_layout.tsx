import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStoreProvider } from "@/src/store/AppStore";
import { AuthProvider } from "@/src/auth/AuthContext";
import { I18nProvider } from "@/src/i18n";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppStoreProvider>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </AppStoreProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
