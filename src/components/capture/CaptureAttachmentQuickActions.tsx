import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '@/src/constants/colors';
import { ActionItem, CaptureAttachmentQuickActionProps } from '@/src/types';
import { Icon } from '@/src/constants/Icon';

const Actions:ActionItem[] = [
    { key: 'image',icon: <Icon name="image" />,label: 'Image'},
    { key: 'audio', icon: <Icon name="voice" />, label: 'Audio' },
    { key: 'video', icon: <Icon name="video" />, label: 'Video' },
    { key: 'file', icon: <Icon name="file" />, label: 'File'},
]

export default function CaptureAttachmentQuickAction({onPress} : CaptureAttachmentQuickActionProps){
    return (
        <View style = {styles.row}>
            {Actions.map((item) => (
                <TouchableOpacity 
                key={item.key}
                style={styles.action}
                onPress={() => onPress(item.key)}
                activeOpacity={0.8}
                >
                    <Text style={styles.icon}>{item.icon}</Text>
                    <Text style={styles.label}>{item.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    )
}


const styles = StyleSheet.create({
    row: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#101522',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
})