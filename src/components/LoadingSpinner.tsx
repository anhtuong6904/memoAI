import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { LoadingSpinnerProps } from '../types';

export default function LoadingSpinner({
  size  = 'large',
  color = COLORS.accent,
}: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      <Text style={styles.text}>Đang tải...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
});