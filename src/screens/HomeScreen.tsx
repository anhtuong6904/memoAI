import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { FilterKey, Note, RootStackParamList, RootTabParamList } from '../types';
import NoteCard from '../components/NoteCard';
import EmptyState from '../components/EmptyState';
import { useNotes } from '../hooks/useNotes';
import HomeHeader from '../components/home/HomeHeader';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import StatsRow from '../components/home/StatsRow';
import SearchSection from '../components/home/SearchSection';
import ErrorScreen from '../components/Error';
import FilterBar from '../components/home/FilterBar';
import NotesList from '../components/home/NotesList';

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'HomeList'>,
  BottomTabNavigationProp<RootTabParamList>
>;

export default function HomeScreen() {
  const navigation  = useNavigation<NavProp>();
  const { notes, loading, error, reload, removeNote } = useNotes();
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  /* ── derived list ── */
  const filtered = notes.filter(n => {
    const matchType    = filter === 'all' || n.type === filter;
    const query        = search.toLowerCase();
    const matchSearch  = !query
      || n.content.toLowerCase().includes(query)
      || (n.summary ?? '').toLowerCase().includes(query);
    return matchType && matchSearch;
  });

  /* ── handlers ── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  /* ── error state ── */
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorScreen
          value={error}
          onReload={reload}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <HomeHeader 
        total = {notes.length}
        loading = {loading}
        onAddPress = {() => navigation.navigate('Capture')}
      />

      {/* ── Stats row ── */}
      <StatsRow notes={notes} />

      {/* {search section} */}
      <SearchSection 
        value={search}
        onChange={setSearch}
      />

      {/* ── Filter chips ── */}
      <FilterBar
        filter={filter}
        onChange={setFilter}
      />

      {/* ── Notes list ── */}
      <NotesList
        data={filtered}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onDelete={removeNote}
        onPress={(note) => navigation.navigate('Detail', { noteId: note.id })} // ✅ fix luôn bug trước
        search={search}
        filter={filter}
      />
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});