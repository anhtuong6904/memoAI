import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { COLORS } from '../constants/colors';

export default function CaptureScreen() {
  const [title, setTitle]               = useState('');
  const [desc, setDesc]                 = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startTime, setStartTime]       = useState<Date | null>(null);
  const [endTime, setEndTime]           = useState<Date | null>(null);

  const [isDatePickerVisible,  setDatePickerVisibility] = useState(false);
  const [isStartTimeVisible,   setStartTimeVisible]     = useState(false);
  const [isEndTimeVisible,     setEndTimeVisible]       = useState(false);

  const handleConfirmDate = (date: Date) => {
    setSelectedDate(date);
    setDatePickerVisibility(false);
  };

  const handleConfirmStartTime = (time: Date) => {
    setStartTime(time);
    setStartTimeVisible(false);
  };

  const handleConfirmEndTime = (time: Date) => {
    if (startTime && time <= startTime) {
      Alert.alert('Lỗi', 'Giờ kết thúc phải sau giờ bắt đầu!');
      return;
    }
    setEndTime(time);
    setEndTimeVisible(false);
  };

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề');
      return;
    }
    // TODO: gọi API createNote()
    console.log('Tạo note:', { title, desc, selectedDate, startTime, endTime });
    Alert.alert('Thành công', 'Đã tạo ghi chú!');
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tạo ghi chú</Text>
        </View>

        {/* Tiêu đề */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Tiêu đề *</Text>
          <TextInput
            style={styles.textbox}
            placeholder="Nhập tiêu đề..."
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Mô tả */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Mô tả chi tiết</Text>
          <TextInput
            style={[styles.textbox, styles.textboxMulti]}
            placeholder="Nhập mô tả..."
            placeholderTextColor={COLORS.textMuted}
            value={desc}
            onChangeText={setDesc}      // ✅ Fix: CaptureScreen dùng desc riêng
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Ngày */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Ngày</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setDatePickerVisibility(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerText}>
              📅{'  '}
              {selectedDate
                ? selectedDate.toLocaleDateString('vi-VN')
                : 'Chọn ngày...'}
            </Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirmDate}
            onCancel={() => setDatePickerVisibility(false)}
          />
        </View>

        {/* Giờ bắt đầu */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Giờ bắt đầu</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setStartTimeVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerText}>
              ⏰{'  '}
              {startTime ? formatTime(startTime) : 'Chọn giờ bắt đầu...'}
            </Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={isStartTimeVisible}
            mode="time"
            onConfirm={handleConfirmStartTime}
            onCancel={() => setStartTimeVisible(false)}
          />
        </View>

        {/* Giờ kết thúc */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Giờ kết thúc</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setEndTimeVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerText}>
              ⏰{'  '}
              {endTime ? formatTime(endTime) : 'Chọn giờ kết thúc...'}
            </Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={isEndTimeVisible}
            mode="time"
            onConfirm={handleConfirmEndTime}
            onCancel={() => setEndTimeVisible(false)}
          />
        </View>

        {/* AI phân tích — readonly */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>💡 AI phân tích</Text>
          <View style={[styles.textbox, styles.textboxMulti, styles.aiBox]}>
            <Text style={styles.aiText}>
              AI sẽ phân tích và đưa ra gợi ý sau khi bạn lưu ghi chú...
            </Text>
          </View>
        </View>

        {/* Nút tạo */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>＋  Tạo ghi chú</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  inputArea: {
    marginBottom: 16,
  },
  textbox: {
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textboxMulti: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerText: {
    fontSize: 15,
    color: COLORS.text,
  },
  aiBox: {
    justifyContent: 'center',
    opacity: 0.6,
  },
  aiText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  createButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});