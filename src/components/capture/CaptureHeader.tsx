import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@/src/constants/colors';
import { CaptureHeaderProps } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';

export default function CaptureHeader({
  title,
  subtitle,
  onActionPress,
}: CaptureHeaderProps) {
  return (
    <View style={styles.header}>
      {/* LEFT (empty để giữ layout cân đối) */}
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      <View>

      </View>
      <View style = {styles.headerActions}>
      <TouchableOpacity
        style={styles.savebutton}
        onPress={onActionPress}
        activeOpacity={0.85}
      >
        <Ionicons name="checkmark" size={24} color="#fff" />
      </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  /* header */
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.text,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 13,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    savebutton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
});