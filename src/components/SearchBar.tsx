import React from 'react';
import {
  View, TextInput, TouchableOpacity,
  Text, StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/colors';

interface SearchBarProps {
  value:          string;
  onChangeText:   (text: string) => void;
  onSubmit?:      () => void;
  onClear?:       () => void;
  placeholder?:   string;
}

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Tìm kiếm ghi chú...',
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDim}
        returnKeyType="search"
        autoCorrect={false}
      />

      {/* Nút xóa — chỉ hiện khi có text */}
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => { onChangeText(''); onClear?.(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    padding: 0,           // reset default padding Android
  },
  clearIcon: {
    fontSize: 14,
    color: COLORS.textDim,
    fontWeight: '600',
  },
});