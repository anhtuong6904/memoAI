import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { useNavigation }       from '@react-navigation/native';
import DateTimePickerModal     from 'react-native-modal-datetime-picker';
import * as ImagePicker        from 'expo-image-picker';

import { COLORS }                       from '../constants/colors';
import { CaptureMode }                  from '../types';
import { createNote, uploadImage, uploadAudio, uploadVideo } from '../services/api';

import CaptureContentComposer        from '../components/capture/CaptureContentComposer';
import CaptureDateTimeRow            from '../components/capture/CaptureDateTimeRow';
import CaptureHeader                 from '../components/capture/CaptureHeader';
import CaptureModeTabs               from '../components/capture/CaptureModeTabs';
import CaptureSectionCard            from '../components/capture/CaptureSectionCard';
import CaptureAttachmentQuickAction  from '../components/capture/CaptureAttachmentQuickActions';
import CaptureTitleInput             from '../components/capture/CaptureTitleInput';

export default function CaptureScreen() {
  const navigation = useNavigation();

  // ─── State ───────────────────────────────────────────────────────────────
  const [mode,       setMode]       = useState<CaptureMode>('note');
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [tags,       setTags]       = useState('');
  const [saving,     setSaving]     = useState(false);

  // Date/Time picker
  const [selectedDate,         setSelectedDate]         = useState<Date | null>(null);
  const [startTime,            setStartTime]            = useState<Date | null>(null);
  const [endTime,              setEndTime]              = useState<Date | null>(null);
  const [isDatePickerVisible,  setDatePickerVisibility] = useState(false);
  const [isStartTimeVisible,   setStartTimeVisible]     = useState(false);
  const [isEndTimeVisible,     setEndTimeVisible]       = useState(false);

  // ─── Labels ──────────────────────────────────────────────────────────────
  const dateLabel  = useMemo(
    () => selectedDate ? selectedDate.toLocaleDateString('vi-VN') : 'Chọn ngày',
    [selectedDate],
  );
  const startLabel = useMemo(
    () => startTime ? formatTime(startTime) : 'Bắt đầu',
    [startTime],
  );
  const endLabel   = useMemo(
    () => endTime ? formatTime(endTime) : 'Kết thúc',
    [endTime],
  );

  // ─── Date / Time handlers ────────────────────────────────────────────────
  const handleConfirmDate      = (date: Date) => { setSelectedDate(date); setDatePickerVisibility(false); };
  const handleConfirmStartTime = (time: Date) => { setStartTime(time); setStartTimeVisible(false); };
  const handleConfirmEndTime   = (time: Date) => {
    if (startTime && time <= startTime) {
      Alert.alert('Lỗi', 'Giờ kết thúc phải sau giờ bắt đầu!');
      return;
    }
    setEndTime(time);
    setEndTimeVisible(false);
  };

  // ─── Attachment (image / audio / video picker) ───────────────────────────
  const handleAddAttachment = async (type: string) => {
    try {
      if (type === 'image') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          setSaving(true);
          await uploadImage(result.assets[0].uri);
          Alert.alert('Thành công', 'Đã tải ảnh lên!');
        }
      } else if (type === 'video') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        });
        if (!result.canceled && result.assets[0]) {
          setSaving(true);
          await uploadVideo(result.assets[0].uri);
          Alert.alert('Thành công', 'Đã tải video lên!');
        }
      } else {
        Alert.alert('Thông báo', `Chức năng ${type} đang phát triển`);
      }
    } catch (e: unknown) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Upload thất bại');
    } finally {
      setSaving(false);
    }
  };

  // ─── Tạo ghi chú text ────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim() && !desc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề hoặc nội dung');
      return;
    }

    // Ghép nội dung: tiêu đề + body + tags
    const tagList   = tags.trim()
      ? tags.split(/\s+/).filter(t => t.startsWith('#'))
      : [];
    const fullContent = [
      title.trim()   ? `# ${title.trim()}`   : '',
      desc.trim()    ? desc.trim()            : '',
      tagList.length ? tagList.join(' ')      : '',
    ].filter(Boolean).join('\n\n');

    try {
      setSaving(true);
      await createNote(fullContent || title.trim());
      Alert.alert('Thành công', 'Đã lưu ghi chú!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      // Reset form
      setTitle(''); setDesc(''); setTags('');
      setSelectedDate(null); setStartTime(null); setEndTime(null);
    } catch (e: unknown) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không lưu được ghi chú');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <CaptureHeader title="Quick Capture"  />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        

        

        {/* Tiêu đề */}
        <CaptureSectionCard label="Nội dung">
          <CaptureTitleInput value={title} onChangeText={setTitle} />
          <CaptureContentComposer value={desc} onChangeText={setDesc} />
          <TextInput
            style={styles.tagInput}
            placeholder="#project #learning #urgent"
            placeholderTextColor={COLORS.textMuted}
            value={tags}
            onChangeText={setTags}
          />

          <CaptureModeTabs mode={mode} onModeChange={setMode} />
        </CaptureSectionCard>

        {/* Lịch */}
        <CaptureSectionCard label="Lịch" helper="Đặt thời gian cho task hoặc meeting">
          <CaptureDateTimeRow
            dateLabel={dateLabel}
            startLabel={startLabel}
            endLabel={endLabel}
            onPickDate={() => setDatePickerVisibility(true)}
            onPickStart={() => setStartTimeVisible(true)}
            onPickEnd={() => setEndTimeVisible(true)}
          />
        </CaptureSectionCard>

        {/* Đính kèm */}
        <CaptureSectionCard label="Đính kèm" helper="ảnh, video, audio, tài liệu">
          <CaptureAttachmentQuickAction onPress={handleAddAttachment} />
        </CaptureSectionCard>

        {/* AI Summary placeholder */}
        <CaptureSectionCard label="AI Summary" helper="AI sẽ phân tích sau khi lưu">
          <View style={styles.aiBox}>
            <Text style={styles.aiText}>
              {'• Tóm tắt ngắn 2-3 dòng\n• Trích action items\n• Gợi ý nhắc nhở liên quan'}
            </Text>
          </View>
        </CaptureSectionCard>

        {/* Nút lưu */}
        <TouchableOpacity
          style={[styles.createButton, saving && styles.createButtonDisabled]}
          onPress={handleCreate}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.createButtonText}>＋ Lưu ghi chú</Text>
          }
        </TouchableOpacity>

        {/* Pickers */}
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
        />
        <DateTimePickerModal
          isVisible={isStartTimeVisible}
          mode="time"
          onConfirm={handleConfirmStartTime}
          onCancel={() => setStartTimeVisible(false)}
        />
        <DateTimePickerModal
          isVisible={isEndTimeVisible}
          mode="time"
          onConfirm={handleConfirmEndTime}
          onCancel={() => setEndTimeVisible(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  tagInput: {
    fontSize: 14,
    color: COLORS.text,
    borderRadius: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundProp,
    marginTop: 8,
  },
  aiBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundProp,
    padding: 12,
  },
  aiText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 22,
  },
  createButton: {
    marginTop: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});