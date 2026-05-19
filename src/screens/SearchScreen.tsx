import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EmptyState from "../components/EmptyState";
import NoteCard from "../components/NoteCard";
import SearchBar from "../components/SearchBar";
import { COLORS } from "../constants/colors";
import { searchNotes } from "../services/api";
import { Note, RootStackParamList } from "../types";

type Nav = NativeStackNavigationProp<RootStackParamList, "HomeList">;

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchNotes(query);
      setResults(data);
    } catch (e) {
      setResults([]);
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Tìm kiếm thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Tìm kiếm</Text>
        <Text style={s.sub}>Tìm kiếm thông minh qua AI</Text>
      </View>
      <View style={s.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmit={handleSearch}
          onClear={() => {
            setResults([]);
            setSearched(false);
          }}
          placeholder="Ví dụ: số điện thoại của anh Minh..."
        />
      </View>
      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 40 }}
          size="large"
          color={COLORS.accent}
        />
      ) : searched && results.length === 0 ? (
        <EmptyState message="Không tìm thấy kết quả" icon="🔍" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate("Edit", { noteId: item.id })}
            />
          )}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={s.resultCount}>
                {results.length} kết quả cho "{query}"
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  resultCount: { fontSize: 13, color: COLORS.textMuted, marginBottom: 12 },
});
