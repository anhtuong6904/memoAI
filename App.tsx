import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen      from './src/screens/HomeScreen';
import CaptureScreen   from './src/screens/CaptureScreen';
import DetailScreen    from './src/screens/DetailScreen';
import SearchScreen    from './src/screens/SearchScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import { RootStackParamList, RootTabParamList } from './src/types';

const Tab   = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeList" component={HomeScreen} />
      <Stack.Screen name="Detail"   component={DetailScreen} />
    </Stack.Navigator>
  );
}

// ← Tách ra component riêng, hook chạy SAU khi SafeAreaProvider đã mount
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
              backgroundColor: '#0F0F0F',
              borderTopColor:  '#1F2937',
              paddingTop:      0,
              paddingBottom:   insets.bottom + 6,
              height:          62 + insets.bottom,
            },
            tabBarActiveTintColor:   '#6C63FF',
            tabBarInactiveTintColor: '#6B7280',
            tabBarLabelStyle: { fontSize: 11 },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeStack}
            options={{
              tabBarLabel: 'Trang chủ',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Capture"
            component={CaptureScreen}
            options={{
              tabBarLabel: 'Ghi chú',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="add-circle-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{
              tabBarLabel: 'Tìm kiếm',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search-outline" size={size} color={color} />
              ),
            }}
          />
          {/* <Tab.Screen
            name="Detail"
            component={DetailScreen}
            // options={{
            //   tabBarLabel: 'Tìm kiếm',
            //   tabBarIcon: ({ color, size }) => (
            //     <Ionicons name="search-outline" size={size} color={color} />
            //   ),
            // }}
          /> */}
          <Tab.Screen
            name="Reminders"
            component={RemindersScreen}
            options={{
              tabBarLabel: 'Nhắc nhở',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="notifications-outline" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

// ← App chỉ có nhiệm vụ wrap SafeAreaProvider, không dùng hook ở đây
export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
      {/* <HomeStack/> */}
    </SafeAreaProvider>
  );
}