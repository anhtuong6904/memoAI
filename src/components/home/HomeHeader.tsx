import { COLORS } from "@/src/constants/colors";
import { HomeHeaderProps, RootStackParamList } from "@/src/types";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Nav = NativeStackNavigationProp<RootStackParamList, "HomeList">;

export default function HomeHeader({
  total,
  loading,
  onAddPress,
}: HomeHeaderProps) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.title}>MemoAI</Text>
        <Text style={s.sub}>
          {loading ? "Dang tai..." : `${total} ghi chu`}
        </Text>
      </View>
      <TouchableOpacity
        style={s.addBtn}
        onPress={onAddPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 13, color: COLORS.textMuted, marginTop: 1 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
