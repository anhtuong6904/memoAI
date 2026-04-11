import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { TagPillProps } from '../types';

// Màu xoay vòng cho tags
const TAG_COLORS = [
  '#6C63FF', // tím
  '#3B82F6', // xanh
  '#10B981', // xanh lá
  '#F59E0B', // vàng
  '#EF4444', // đỏ
  '#EC4899', // hồng
];

// Dùng label để chọn màu nhất quán
// vd: tag "Công việc" luôn ra cùng 1 màu
const getTagColor = (label: string): string => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

export default function TagPill({ label, color }: TagPillProps) {
  const bgColor = color ?? getTagColor(label);

  return (
    <View style={[styles.pill, { backgroundColor: bgColor + '25' }]}>
      <Text style={[styles.label, { color: bgColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});