import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { COLORS } from '../constants/colors';

export default function CaptureScreen() {
  const [title, setTitle]               = useState('');
  const [desc, setDesc]                 = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);

  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isStartTimeVisible, setStartTimeVisible] = useState(false);
  const [isEndTimeVisible, setEndTimeVisible] = useState(false);


  const handleConfirmStartTime = (time: Date) => {
    setStartTime(time);
    setStartTimeVisible(false);
  };

  const handleConfirmEndTime = (time: Date) => {
    if (startTime && time <= startTime) {
      alert("Giờ kết thúc phải sau giờ bắt đầu!");
    return;
    } 
    setEndTime(time);
    setEndTimeVisible(false);
       
  };
  const handleConfirm = (date: Date) => {
    setSelectedDate(date);   // 🔥 QUAN TRỌNG
    setDatePickerVisibility(false);
  };
  


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tạo ghi chú</Text>
        </View>

        {/* Tiêu đề */}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Tiêu đề</Text>
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
            placeholder="Mô tả chi tiết..."
            placeholderTextColor={COLORS.textMuted}
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Date picker*/}
        <View style={styles.inputArea}>
          <Text style={styles.label}>Ngày</Text>

          {/* Nút bấm → gọi showPicker() qua ref */}
          <TouchableOpacity
            style={styles.dateButton}
            onPress={()=>setDatePickerVisibility(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateButtonText}>
              📅{'  '}
              {selectedDate
                ? selectedDate.toLocaleDateString('vi-VN')
                : 'Chọn ngày...'}
            </Text>
          </TouchableOpacity>
          

          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirm}
            onCancel={()=>setDatePickerVisibility(false)}
          />
          </View>
          {/* Start Time */}
          <View style={styles.inputArea}>
            <Text style={styles.label}>Giờ bắt đầu</Text>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setStartTimeVisible(true)}
            >
              <Text style={styles.dateButtonText}>
                ⏰{' '}
                {startTime
                  ? startTime.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Chọn giờ bắt đầu...'}
              </Text>
            </TouchableOpacity>

            <DateTimePickerModal
              isVisible={isStartTimeVisible}
              mode="time"
              onConfirm={handleConfirmStartTime}
              onCancel={() => setStartTimeVisible(false)}
            />
          </View>

          {/* End Time */}
          <View style={styles.inputArea}>
          <Text style={styles.label}>Giờ kết thúc</Text>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setEndTimeVisible(true)}
            >
              <Text style={styles.dateButtonText}>
                ⏰{' '}
                {endTime
                  ? endTime.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Chọn giờ kết thúc...'}
              </Text>
            </TouchableOpacity>

          <DateTimePickerModal
            isVisible={isEndTimeVisible}
            mode="time"
            onConfirm={handleConfirmEndTime}
            onCancel={() => setEndTimeVisible(false)}
          />
        </View>
        {/* AI */}
        <View style={styles.inputArea}>
          <Text style={styles.sectionTitle}>AI Phân tích lời khuyên sắp xếp</Text>
          <TextInput
            style={[styles.textbox, styles.textboxMulti]}
            placeholder="AI đang phân tích."
            placeholderTextColor={COLORS.textMuted}
            value={desc}
            multiline
            numberOfLines={4}
          />
        </View>

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
    paddingBottom: 32,
  },
  header: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface ?? '#1A1A2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  textboxMulti: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: COLORS.surface ?? '#1A1A2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  dateButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
});