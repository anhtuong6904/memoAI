import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  FlatList, ListRenderItem, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { Note } from '../types';
import NoteCard from '../components/NoteCard';
import EmptyState from '../components/EmptyState';
import SearchBar from '../components/SearchBar';

// Data tạm — sau này thay bằng API
const DATA: Note[] = [
  {
    id: 1,
    content: 'Họp nhóm lúc 9 giờ sáng, chuẩn bị slide báo cáo Q2.',
    summary: 'Họp nhóm buổi sáng',
    type: 'text',
    tags: '["Công việc","Quan trọng"]',
    created_at: '2024-06-01T09:00:00Z',
  },
  {
    id: 2,
    content: 'Mua sữa, trứng, bánh mì và rau cải.',
    summary: 'Danh sách mua sắm',
    type: 'text',
    tags: '["Cá nhân"]',
    created_at: '2024-06-01T10:30:00Z',
  },
  {
    id: 3,
    content: 'Đọc sách "Atomic Habits" chương 5 về thói quen nhỏ.',
    summary: undefined,
    type: 'text',
    tags: '[]',
    created_at: '2024-06-01T20:00:00Z',
  },
];

export default function HomeScreen() {
  const [notes, setNotes]       = useState<Note[]>(DATA);
  const [search, setSearch]     = useState('');

  // Lọc notes theo search
  const filtered = notes.filter(n =>
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    (n.summary ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: number) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const renderItem: ListRenderItem<Note> = ({ item }) => (
    <NoteCard
      note={item}
      onPress={()   => console.log('Mở note:', item.id)}
      onDelete={()  => handleDelete(item.id)}
      onHold={()    => console.log('Hold:', item.id)}
    />
  );

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ghi chú</Text>
          <Text style={styles.headerCount}>{notes.length} ghi chú</Text>
        </View>
        {/* Nút thêm mới */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => console.log('Thêm ghi chú')}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm kiếm ghi chú..."
        />
      </View>

      {/* Danh sách ghi chú */}
      <FlatList<Note>
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            message="Chưa có ghi chú nào"
            icon="📭"
          />
        }
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerCount: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 26,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listEmpty: {
    flex: 1,
  },
});