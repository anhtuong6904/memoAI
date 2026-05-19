import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/colors";
import { createReminder } from "../../services/api";
import { scheduleReminderNotification } from "../../services/notifications";
import { Reminder } from "../../types";

const defaultDate = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
};

const fmtPickerDate = (d: Date) =>
  d.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const fmtPickerTime = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (reminder: Reminder) => void;
}

export function AddReminderModal({ visible, onClose, onCreated }: Props) {
  const [addTitle, setAddTitle] = useState("");
  const [pickerDate, setPickerDate] = useState<Date>(defaultDate());
  const [adding, setAdding] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reset state each time modal opens
  useEffect(() => {
    if (visible) {
      setAddTitle("");
      setPickerDate(defaultDate());
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible]);

  const onAndroidDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (event.type === "set" && date) {
      const next = new Date(date);
      next.setHours(pickerDate.getHours(), pickerDate.getMinutes(), 0, 0);
      setPickerDate(next);
      setShowTimePicker(true);
    }
  };

  const onAndroidTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (event.type === "set" && date) setPickerDate(date);
  };

  const onIOSChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setPickerDate(date);
  };

  const handleAdd = async () => {
    const title = addTitle.trim();
    if (!title) {
      Alert.alert("Thiếu tiêu đề", "Hãy nhập tiêu đề nhắc nhở.");
      return;
    }
    if (pickerDate < new Date(Date.now() + 60_000)) {
      Alert.alert("Thời gian đã qua", "Hãy chọn thời gian ít nhất 1 phút trong tương lai.");
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso =
      `${pickerDate.getFullYear()}-${pad(pickerDate.getMonth() + 1)}-${pad(pickerDate.getDate())}` +
      `T${pad(pickerDate.getHours())}:${pad(pickerDate.getMinutes())}:00`;
    setAdding(true);
    try {
      const reminder = await createReminder({ title, remind_at: iso });
      await scheduleReminderNotification(reminder);
      onCreated(reminder);
      onClose();
    } catch {
      Alert.alert("Lỗi", "Không thể tạo nhắc nhở. Kiểm tra backend.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.sheet}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Thêm nhắc nhở</Text>

          <Text style={s.label}>Tiêu đề</Text>
          <TextInput
            style={s.input}
            value={addTitle}
            onChangeText={setAddTitle}
            placeholder="Ví dụ: Họp nhóm, Nộp báo cáo..."
            placeholderTextColor={COLORS.textDim}
            returnKeyType="done"
            autoFocus
          />

          {Platform.OS === "ios" && (
            <>
              <Text style={s.label}>Ngày & Giờ</Text>
              <View style={s.iosPickerWrap}>
                <DateTimePicker
                  value={pickerDate}
                  mode="datetime"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={onIOSChange}
                  locale="vi"
                  themeVariant="dark"
                  accentColor={COLORS.accent}
                  minuteInterval={5}
                />
              </View>
            </>
          )}

          {Platform.OS === "android" && (
            <>
              <Text style={s.label}>Ngày & Giờ</Text>
              <View style={s.androidRow}>
                <TouchableOpacity
                  style={s.androidPickBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color={COLORS.accent} />
                  <Text style={s.androidPickTx}>{fmtPickerDate(pickerDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.androidPickBtn, { flex: 0, paddingHorizontal: 16 }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={16} color={COLORS.accent} />
                  <Text style={s.androidPickTx}>{fmtPickerTime(pickerDate)}</Text>
                </TouchableOpacity>
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={onAndroidDateChange}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  is24Hour
                  onChange={onAndroidTimeChange}
                />
              )}
            </>
          )}

          <View style={s.preview}>
            <Ionicons name="notifications-outline" size={14} color={COLORS.accent} />
            <Text style={s.previewTx}>
              Nhắc lúc {fmtPickerTime(pickerDate)},{" "}
              {pickerDate.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.confirmBtn, adding && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={adding}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.confirmTx}>Tạo nhắc nhở</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
    paddingHorizontal: 20,
    marginBottom: 6,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  iosPickerWrap: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
  },
  androidRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  androidPickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  androidPickTx: { fontSize: 13, color: COLORS.text, fontWeight: "500" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: `${COLORS.accent}18`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  previewTx: { fontSize: 13, color: COLORS.accent, flex: 1 },
  confirmBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginHorizontal: 20,
  },
  confirmTx: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
