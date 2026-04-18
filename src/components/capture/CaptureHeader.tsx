// src/components/capture/CaptureHeader.tsx
import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../constants/colors';

interface CaptureHeaderProps {
  title:         string;
  subtitle:      string;
  onActionPress: () => void;
  isLoading?:    boolean;   // ✅ Thêm prop này
}

export default function CaptureHeader({
  title, subtitle, onActionPress, isLoading = false,
}: CaptureHeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity
        style={[styles.btn, isLoading && styles.btnDisabled]}
        onPress={onActionPress}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.btnText}>Lưu ✓</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      COLORS.text,
  },
  subtitle: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop: 2,
  },
  btn: {
    backgroundColor:   COLORS.accent,
    borderRadius:      20,
    paddingHorizontal: 18,
    paddingVertical:   8,
    minWidth:          70,
    alignItems:        'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color:      '#fff',
    fontWeight: '700',
    fontSize:   14,
  },
});