import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@/src/constants/colors';
import { CaptureHeaderProps } from '@/src/types/index';
import { Icon } from '@/src/constants/Icon';

const savebutton = <Icon name= 'save'/>
export default function CaptureHeader({
  title,
  subtitle,
  actionIcon = savebutton,
  onActionPress,
}: CaptureHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionIcon && onActionPress ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onActionPress}
          activeOpacity={0.85}
        >
          {actionIcon}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    textBlock: {
        flex: 1,
    },
    title: {
        fontSize: 27,
        fontWeight: '700',
        color: COLORS.text,
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: COLORS.textMuted,
    },
    actionButton: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignSelf: 'center',
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
})