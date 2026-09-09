import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import BestiaryScreen from "../screens/BestiaryScreen";
import HuntsScreen from "../screens/HuntsScreen";
import ForumScreen from "../screens/ForumScreen";
import QuestBoardScreen from "../screens/QuestBoardScreen";
import ShopScreen from "../screens/ShopScreen";

const Tab = createBottomTabNavigator();

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen name="Bestiário" component={BestiaryScreen} />
      <Tab.Screen name="Hunts" component={HuntsScreen} />
      <Tab.Screen name="Fórum" component={ForumScreen} />
      <Tab.Screen name="Quest Board" component={QuestBoardScreen} />
      <Tab.Screen name="Shop" component={ShopScreen} />
    </Tab.Navigator>
  );
}