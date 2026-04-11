import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { EmptyStateProps } from '../types';

export default function EmptyState({ message, icon = '📭' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.sub}>Nhấn "Ghi chú" bên dưới để thêm mới</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  icon: {
    fontSize: 52,
    marginBottom: 16,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});