import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";
import { getAllReminders, markReminderDone } from "../services/api";
import { Reminder } from "../types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setReminders(await getAllReminders());
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDone = async (id: number) => {
    await markReminderDone(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Nhac nho</Text>
        <Text style={s.sub}>{reminders.length} chua hoan thanh</Text>
      </View>
      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 40 }}
          size="large"
          color={COLORS.accent}
        />
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={s.list}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyText}>Khong co nhac nho nao</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <Ionicons
                  name="alarm-outline"
                  size={20}
                  color={COLORS.accent}
                />
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.note_title && (
                  <Text style={s.cardNote}>{item.note_title}</Text>
                )}
                <Text style={s.cardTime}>{fmtDate(item.remind_at)}</Text>
              </View>
              <TouchableOpacity
                style={s.doneBtn}
                onPress={() => handleDone(item.id)}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color={COLORS.success}
                />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textMuted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.active,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  cardNote: { fontSize: 12, color: COLORS.accent },
  cardTime: { fontSize: 12, color: COLORS.textMuted },
  doneBtn: { padding: 4 },
});
