import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import ChatScreen from "./src/screens/ChatScreen";
import EditScreen from "./src/screens/DetailEditScreen";
import HomeScreen from "./src/screens/HomeScreen";
import RemindersScreen from "./src/screens/RemindersScreen";
import SearchScreen from "./src/screens/SearchScreen";
import { RootStackParamList, RootTabParamList } from "./src/types";

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeList" component={HomeScreen} />
      <Stack.Screen name="Edit" component={EditScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: "#0F0F0F",
              borderTopColor: "#1F2937",
              paddingBottom: insets.bottom + 6,
              height: 62 + insets.bottom,
            },
            tabBarActiveTintColor: "#6C63FF",
            tabBarInactiveTintColor: "#6B7280",
            tabBarLabelStyle: { fontSize: 11 },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeStack}
            options={{
              tabBarLabel: "Trang chu",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{
              tabBarLabel: "Tim kiem",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              tabBarLabel: "Chat AI",
              tabBarIcon: ({ color, size }) => (
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
          <Tab.Screen
            name="Reminders"
            component={RemindersScreen}
            options={{
              tabBarLabel: "Nhac nho",
              tabBarIcon: ({ color, size }) => (
                <Ionicons
                  name="notifications-outline"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
