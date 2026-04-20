import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  FlatList, ListRenderItem, TouchableOpacity,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { useNavigation }       from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp }   from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp }   from '@react-navigation/native';

import { COLORS } from '../constants/colors';
import { Note, RootStackParamList } from '../types';
import { useNotes } from '../hooks/useNotes';

import NoteCard   from '../components/NoteCard';
import EmptyState from '../components/EmptyState';
import SearchBar  from '../components/SearchBar';

type Nav = NativeStackNavigationProp<RootStackParamList, 'HomeList'>;

export default function HomeScreen() {
  const navigation            = useNavigation<Nav>();
  const { notes, loading, error, reload, removeNote } = useNotes();
  const [search, setSearch]   = useState('');

  // Lọc local theo từ khoá tìm kiếm
  const filtered = notes.filter(n =>
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    (n.summary ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const renderItem: ListRenderItem<Note> = ({ item }) => (
    <NoteCard
      note={item}
      onPress={() => navigation.navigate('Edit', { noteId: item.id })}
      onDelete={() => removeNote(item.id)}
      onHold={() => console.log('Hold:', item.id)}
    />
  );

  /* ─── Trạng thái loading ─── */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.statusText}>Đang tải ghi chú…</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Trạng thái lỗi ─── */
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ghi chú</Text>
          <Text style={styles.headerCount}>{notes.length} ghi chú</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('Edit',{ noteId: undefined })}
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
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        onRefresh={reload}
        refreshing={loading}
        ListEmptyComponent={
          <EmptyState
            message={search ? 'Không tìm thấy ghi chú' : 'Chưa có ghi chú nào'}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
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