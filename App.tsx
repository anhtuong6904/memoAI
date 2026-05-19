import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { requestNotificationPermissions } from "./src/services/notifications";
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

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

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
              paddingBottom: 0,
              height: 40 + insets.bottom,
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
              tabBarLabel: "Trang chủ",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{
              tabBarLabel: "Tìm kiếm",
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
              tabBarLabel: "Nhắc nhở",
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

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>Có lỗi xảy ra</Text>
          <Text style={eb.message}>
            {this.state.error?.message ?? "Lỗi không xác định"}
          </Text>
          <TouchableOpacity
            style={eb.btn}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={eb.btnTx}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F0F0F",
    padding: 24,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  message: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 24,
  },
  btn: {
    backgroundColor: "#6C63FF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnTx: { color: "#fff", fontWeight: "600" },
});

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
