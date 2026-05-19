import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../constants/colors";
import { Reminder } from "../../types";
import { fmtDate } from "../../utils/format";

interface Props {
  reminder: Reminder;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
}

export function ReminderCard({ reminder, onDone, onDelete }: Props) {
  return (
    <View style={s.card}>
      <View style={s.cardLeft}>
        <Ionicons name="alarm-outline" size={20} color={COLORS.accent} />
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{reminder.title}</Text>
        {reminder.note_title && (
          <Text style={s.cardNote}>{reminder.note_title}</Text>
        )}
        <Text style={s.cardTime}>{fmtDate(reminder.remind_at)}</Text>
      </View>
      <TouchableOpacity style={s.doneBtn} onPress={() => onDone(reminder.id)}>
        <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
      </TouchableOpacity>
      <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(reminder.id)}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
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
  deleteBtn: { padding: 4, marginLeft: 4 },
});
