import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import NoteCard from '../components/NoteCard';
import { Note, NoteCardProps } from '../types';
import { Touchable } from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';

const DATA: Note[] = [
  // {
  //   id: 1,
  //   content: 'Họp nhóm lúc 9 giờ sáng, chuẩn bị slide báo cáo Q2.',
  //   summary: 'Họp nhóm buổi sáng',
  //   type: 'text',
  //   tags: '["Công việc", "Quan trọng"]',
  //   created_at: '2024-06-01T09:00:00Z',
  // },
  // {
  //   id: 2,
  //   content: 'Mua sữa, trứng, bánh mì và rau cải.',
  //   summary: 'Danh sách mua sắm',
  //   type: 'text',
  //   tags: '["Cá nhân"]',
  //   created_at: '2024-06-01T10:30:00Z',
  // },
  // {
  //   id: 3,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 4,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 5,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 6,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 7,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 8,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 9,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 10,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 11,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 12,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 13,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },{
  //   id: 14,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 15,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 16,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },
  // {
  //   id: 17,
  //   content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
  //   summary: undefined,
  //   type: 'text',
  //   tags: '[]',
  //   created_at: '2024-06-01T20:00:00Z',
  // },

];



export default function HomeScreen() {

  //data
  const [notes, setNotes] = useState<Note[]>(DATA);

  //hàm dùng để render Item
  const renderItem : ListRenderItem<Note> = ({item}) => (
    <NoteCard 
      note={item} 
      onPress={() => console.log('Mở Note:', item.id )}
      onDelete={() => console.log ('Xóa Note:', item.id)}
      onHold={() => console.log("hold")}
    />
  )

  //hàm render hàm rỗng
  const renderEmptyItem = () => (
    <View >
      <Text style = {styles.title}>Chưa có Note nào</Text>
      <Text style = {styles.title}>Chọn "+" để thêm ghi chú mới</Text>
    </View>
  );


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ghi chú</Text>
        <Text style={styles.title}>{notes.length} ghi chú</Text>
      </View>
      <FlatList <Note>
        data = {notes} 
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent= {renderEmptyItem}
        contentContainerStyle = {[
          styles.listContent ,
          notes.length === 0 && styles.listEmpty
        ]}
        showsVerticalScrollIndicator={false}

      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // FlatList
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listEmpty: {
    flex:1,

    color:"#ffffff",
    
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon:      { fontSize: 52, marginBottom: 12 },
  title:     { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  text:      { flex: 1 ,fontSize: 32, color: COLORS.text, justifyContent: 'center', alignContent:"center"},
  sub:       { fontSize: 14, color: COLORS.textMuted, marginTop: 6 },
});