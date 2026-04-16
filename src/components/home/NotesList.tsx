import { Note, NotesListProps } from "@/src/types";
import { FlatList, ListRenderItem, RefreshControl, StyleSheet, View } from "react-native";
import NoteCard from "../NoteCard";
import { COLORS } from "@/src/constants/colors";
import EmptyState from "../EmptyState";

export default function NotesList({
  data,
  loading,
  refreshing,
  onRefresh,
  onDelete,
  onPress,
  search,
  filter,
}: NotesListProps) {

  const renderItem: ListRenderItem<Note> = ({ item }) => (
    <NoteCard
      note={item}
      onPress={() => onPress(item)}     // ✅ gọi từ props
      onDelete={() => onDelete(item.id)} // ✅ gọi từ props
    />
  );

  return (
    <FlatList
      data={data}
      keyExtractor={n => n.id.toString()}
      renderItem={renderItem}
      contentContainerStyle={[
        styles.listContent,
        data.length === 0 && styles.listEmpty, // ✅ fix bug
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
      ListEmptyComponent={
        loading ? null : (
          <EmptyState
            message={
              search || filter !== 'all'
                ? 'Không tìm thấy ghi chú nào'
                : 'Chưa có ghi chú nào'
            }
            icon={search ? '🔍' : '📝'}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
    /* list */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listEmpty: {
    flex: 1,
  },
})