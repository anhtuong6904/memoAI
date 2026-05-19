import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddReminderModal } from "../components/Reminders/AddReminderModal";
import { ReminderCard } from "../components/Reminders/ReminderCard";
import { COLORS } from "../constants/colors";
import { deleteReminder, getAllReminders, markReminderDone } from "../services/api";
import { cancelReminderNotification, syncReminderNotifications } from "../services/notifications";
import { Reminder } from "../types";

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllReminders();
      setReminders(data);
      syncReminderNotifications(data);
    } catch (e) {
      setReminders([]);
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể tải nhắc nhở.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDone = async (id: number) => {
    const prev = reminders.find((r) => r.id === id);
    setReminders((p) => p.filter((r) => r.id !== id));
    try {
      await markReminderDone(id);
      cancelReminderNotification(id);
    } catch {
      if (prev)
        setReminders((p) =>
          [...p, prev].sort(
            (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime(),
          ),
        );
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Xóa nhắc nhở", "Bạn chắc chắn muốn xóa nhắc nhở này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReminder(id);
            cancelReminderNotification(id);
            setReminders((prev) => prev.filter((r) => r.id !== id));
          } catch {
            Alert.alert("Lỗi", "Không thể xóa nhắc nhở.");
          }
        },
      },
    ]);
  };

  const handleCreated = (reminder: Reminder) =>
    setReminders((prev) =>
      [...prev, reminder].sort(
        (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime(),
      ),
    );

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Nhắc nhở</Text>
          <Text style={s.sub}>{reminders.length} chưa hoàn thành</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.accent} />
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
              <Text style={s.emptyText}>Không có nhắc nhở nào</Text>
              <Text style={s.emptySub}>
                Nhấn + để thêm, hoặc để AI tự phát hiện từ ghi chú
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onDone={handleDone}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      <AddReminderModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={handleCreated}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  empty: { alignItems: "center", paddingTop: 72, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textMuted, fontWeight: "600" },
  emptySub: { fontSize: 13, color: COLORS.textDim, textAlign: "center", marginTop: 6 },
});
