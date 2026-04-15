import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { COLORS } from '../constants/colors';
import { CaptureMode } from '../types';
import CaptureContentComposer from '../components/capture/CaptureContentComposer';
import CaptureDateTimeRow from '../components/capture/CaptureDateTimeRow';
import CaptureHeader from '../components/capture/CaptureHeader';
import CaptureModeTabs from '../components/capture/CaptureModeTabs';
import CaptureSectionCard from '../components/capture/CaptureSectionCard';
import CaptureAttachmentQuickAction from '../components/capture/CaptureAttachmentQuickActions';
import CaptureTitleInput from '../components/capture/CaptureTitleInput';

export default function CaptureScreen() {

  //set cac stat
  const [mode, setMode] = useState<CaptureMode>('note');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedDate, setSelectedDate] = useState <Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date |null> (null);
  const [tags, setTags] = useState('');
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isStartTimeVisible, setStartTimeVisible] = useState(false);
  const [isEndTimeVisible, setEndTimeVisible] = useState(false);


  const dateLabel = useMemo(
    () => (selectedDate ? selectedDate.toLocaleDateString('vi-VN') : 'Chọn ngày'),
    [selectedDate],
  );

  const startLabel = useMemo(
    () => (startTime ? formatTime(startTime) : 'Bắt đầu'),
    [startTime],
  );

  const endLabel = useMemo(
    () => (endTime ? formatTime(endTime) : 'Kết thúc'),
    [endTime],
  );

  const handleConfirmDate = (date: Date) => {
    setSelectedDate (date);
    setDatePickerVisibility(false);
  }

  const handleConfirmStartTime = (time: Date) => { 
    setStartTime(time);
    setDatePickerVisibility(false);
  }

  const handleConfirmEndTime = (time: Date) => {
    if(startTime && time <= startTime){
      Alert.alert('Lỗi', 'Giờ kết thúc phải sau giờ bắt đàu!');
      return;
    }
    setEndTime(time);
    setEndTimeVisible(false);
  }

  const handelAddAttachment = (type: string) => {
    Alert.alert('Thông báo', `Bạn chọn thêm ${type}.`);
  }

  const handleCreate = () =>{
    if(!title.trim()){
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề');
      return;
    }
    //goi API createNote()/upload
    console.log('Taọ note: ', {mode, title, desc, tags, selectedDate, startTime, endTime});
    Alert.alert('Thành công', "Đã tạo ghi chú!");
  }

  return(
    <SafeAreaView style = {styles.container}>
      <ScrollView 
      contentContainerStyle = {styles.scroll}
      keyboardShouldPersistTaps = 'handled'
      showsVerticalScrollIndicator = {false}
      >

        {/* {bố cục gồm các section card từ header content calender attachment AI Summary button create} */}
        <CaptureHeader 
          title='Quick Capture'
          subtitle=''
        />

        <CaptureModeTabs mode={mode} onModeChange={setMode}/>

        <CaptureSectionCard 
        label='Tiêu đề' 
        helper=''>
          <CaptureTitleInput value={title} onChangeText={setTitle}/>
        </CaptureSectionCard>

        <CaptureSectionCard 
        label='Nội dung' 
        helper=''>
          <CaptureContentComposer value={desc} onChangeText={setDesc}/>
          <TextInput
            style={[styles.tagInput]}
            placeholder='#project #learning #urgent'
            placeholderTextColor={COLORS.textMuted}
            value={tags}
            onChangeText={setTags}
          />
        </CaptureSectionCard>

        <CaptureSectionCard label="Lịch" helper="Đặt thời gian cho task hoặc meeting note">
          <CaptureDateTimeRow
            dateLabel={dateLabel}
            startLabel={startLabel}
            endLabel={endLabel}
            onPickDate={() => setDatePickerVisibility(true)}
            onPickStart={() => setStartTimeVisible(true)}
            onPickEnd={() => setEndTimeVisible(true)}
          />
        </CaptureSectionCard>

        <CaptureSectionCard 
        label='Đính kèm' 
        helper='ảnh, video, audio, tài liệu'>
          <CaptureAttachmentQuickAction onPress={handelAddAttachment}/>
        </CaptureSectionCard>
         <CaptureSectionCard 
        label='Summary' 
        helper='AI sẽ phân tích'>
          <View style={styles.aiBox}>
            <Text style={styles.aiText}>
              AI sẽ phân tích và đưa ra gợi ý sau khi bạn lưu ghi chú...
              • Tóm tắt ngắn 2-3 dòng{`\n`}
              • Trích action items{`\n`}
              • Gợi ý nhắc nhở liên quan
            </Text>
          </View>
        </CaptureSectionCard>

        {/*nut tao*/}
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          activeOpacity={0.85}
        >
          <Text style={styles.createButtonText}>+ Create</Text>
          <Text style={styles.createButtonText}>Lưu ghi chú</Text>
        </TouchableOpacity>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="datetime"
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
        />

        <DateTimePickerModal
          isVisible={isStartTimeVisible}
          mode="datetime"
          onConfirm={handleConfirmStartTime}
          onCancel={() => setStartTimeVisible(false)}
        />

        <DateTimePickerModal
          isVisible={isEndTimeVisible}
          mode="datetime"
          onConfirm={handleConfirmEndTime}
          onCancel={() => setEndTimeVisible(false)}
        />
      </ScrollView>

    </SafeAreaView>
  )
}

const formatTime = (date: Date) =>
  date.toLocaleDateString('vi-VN', {hour: '2-digit', minute: '2-digit'});

const styles = StyleSheet.create({
  container:{
    flex: 1,
    backgroundColor:COLORS.background,
  },
  scroll:{
    paddingHorizontal:16,
    paddingBottom: 40,
  },
  tagInput:{
    fontSize: 14,
    color: COLORS.text,
    borderRadius: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundProp
  },
  aiBox:{
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundProp,
    padding: 12,
  },
  aiText:{
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  createButton:{
    marginTop: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems:'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  createButtonText:{
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight:'700',
  },
});

