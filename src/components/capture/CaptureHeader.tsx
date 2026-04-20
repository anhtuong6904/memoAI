// src/components/capture/CaptureHeader.tsx
import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../constants/colors';

import { CaptureHeaderProps } from '@/src/types';


export default function CaptureHeader({
  title, 
}: CaptureHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
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