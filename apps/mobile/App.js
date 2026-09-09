import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import Tabs from "./src/navigation/Tabs";
import { AppStoreProvider } from "./src/store/AppStore";

export default function App() {
  return (
    <AppStoreProvider>
      <NavigationContainer>
        <Tabs />
      </NavigationContainer>
    </AppStoreProvider>
  );
}