import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/colors";
import { Note } from "../../types";
import { fmtDate } from "../../utils/format";

interface Props {
  saving: boolean;
  analyzing: boolean;
  note: Note | null;
  fadeAnim: Animated.Value;
  showChatBtn: boolean;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenChat: () => void;
}

export function EditorTopBar({
  saving,
  analyzing,
  note,
  fadeAnim,
  showChatBtn,
  onBack,
  onSave,
  onDelete,
  onOpenChat,
}: Props) {
  return (
    <View style={s.bar}>
      <TouchableOpacity
        style={s.barBtn}
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={26} color={COLORS.accent} />
      </TouchableOpacity>

      <View style={s.barCenter} pointerEvents="none">
        {saving ? (
          <View style={s.row}>
            <ActivityIndicator size="small" color={COLORS.textDim} style={{ marginRight: 6 }} />
            <Text style={s.dim}>Đang lưu...</Text>
          </View>
        ) : analyzing ? (
          <View style={s.row}>
            <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 6 }} />
            <Text style={[s.dim, { color: COLORS.accent }]}>AI đang phân tích...</Text>
          </View>
        ) : (
          <>
            <Animated.Text style={[s.flash, { opacity: fadeAnim }]}>Đã lưu ✓</Animated.Text>
            <Text style={s.dim} numberOfLines={1}>
              {note ? fmtDate(note.updated_at) : "Ghi chú mới"}
            </Text>
          </>
        )}
      </View>

      <View style={s.barActions}>
        {showChatBtn && (
          <TouchableOpacity style={s.iconBtn} onPress={onOpenChat}>
            <Ionicons name="sparkles-outline" size={18} color={COLORS.accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.iconBtn, s.iconBtnSave, saving && { opacity: 0.4 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={19} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 10,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  barBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  barCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  barActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  dim: { fontSize: 12, color: COLORS.textDim },
  flash: {
    position: "absolute",
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "600",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  iconBtnSave: { backgroundColor: COLORS.accent },
});
