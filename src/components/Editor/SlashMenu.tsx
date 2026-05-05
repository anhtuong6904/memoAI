// src/components/BlockEditor/SlashMenu.tsx
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ListRenderItem,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { SlashCommand, SLASH_COMMANDS, BlockType } from '../../types';

interface SlashMenuProps {
  query:    string;            // text sau dấu /
  onSelect: (type: BlockType) => void;
  onClose:  () => void;
}

export default function SlashMenu({ query, onSelect, onClose }: SlashMenuProps) {
  // Lọc commands theo query
  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.desc.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  const renderItem: ListRenderItem<SlashCommand> = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onSelect(item.id)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>

      {/* Label + desc */}
      <View style={styles.textBox}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.desc}>{item.desc}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Loại block</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: '#1A1A2E',
    borderTopWidth:  1,
    borderTopColor:  COLORS.border,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    maxHeight:       320,
    zIndex:          999,
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    fontSize: 13,
    color:    COLORS.textMuted,
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 14,
    color:    COLORS.textDim,
    padding:  4,
  },
  item: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap: 12,
  },
  iconBox: {
    width:           36,
    height:          36,
    borderRadius:    8,
    backgroundColor: '#252542',
    alignItems:      'center',
    justifyContent:  'center',
  },
  icon: {
    fontSize:   15,
    color:      COLORS.text,
    fontWeight: '700',
  },
  textBox: {
    flex: 1,
  },
  label: {
    fontSize:   14,
    fontWeight: '600',
    color:      COLORS.text,
  },
  desc: {
    fontSize: 12,
    color:    COLORS.textMuted,
    marginTop: 1,
  },
});