import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type RouteType = RouteProp<RootStackParamList, 'Detail'>;

export default function DetailScreen() {
  const route = useRoute<RouteType>();
  const { note } = route.params;
  return (
    <SafeAreaView style={styles.container}>
      {/* <Text style = {styles.listContent}>{note.}</Text> */}
      <Text style = {styles.headerTitle}>{note.content}</Text>
      <Text  style = {styles.headerTitle}>{note.summary}</Text>
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