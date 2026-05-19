import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { useNotes } from "../hooks/useNotes";
import { Note, RootStackParamList } from "../types";

import EmptyState from "../components/EmptyState";
import NoteCard from "../components/NoteCard";
import SearchBar from "../components/SearchBar";

type Nav = NativeStackNavigationProp<RootStackParamList, "HomeList">;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { notes, loading, error, reload, removeNote } = useNotes();
  const [search, setSearch] = useState("");

  // Reload danh sách mỗi khi quay lại HomeScreen (sau khi edit/tạo note)
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const q = search.toLowerCase();
  const filtered = search
    ? notes.filter(
        (n) =>
          (n.title ?? "").toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.summary ?? "").toLowerCase().includes(q),
      )
    : notes;

  const renderItem: ListRenderItem<Note> = ({ item }) => (
    <NoteCard
      note={item}
      onPress={() => navigation.navigate("Edit", { noteId: item.id, initialNote: item })}
      onDelete={() => removeNote(item.id)}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ghi chú</Text>
          <Text style={styles.headerCount}>{notes.length} ghi chú</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate("Edit", { noteId: undefined })}
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

      {/* Error banner — không block UI */}
      {error && !loading && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText} numberOfLines={1}>⚠️ {error}</Text>
          <TouchableOpacity onPress={reload}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Danh sách — luôn render, loading hiện trong RefreshControl */}
      <FlatList<Note>
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        onRefresh={reload}
        refreshing={loading}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={COLORS.accent} size="large" />
            </View>
          ) : (
            <EmptyState
              message={search ? "Không tìm thấy ghi chú" : "Chưa có ghi chú nào"}
              icon="📭"
            />
          )
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
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
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    fontSize: 22,
    color: "#FFFFFF",
    lineHeight: 26,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: `${COLORS.danger}22`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  loadingCenter: {
    paddingTop: 80,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listEmpty: {
    flex: 1,
  },
});
