// src/components/BlockEditor/BlockItem.tsx
import React, { useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, TextInputKeyPressEventData,
  NativeSyntheticEvent,
} from 'react-native';
import { Block } from '../../types';
import { COLORS } from '../../constants/colors';

interface BlockItemProps {
  block:        Block;
  index:        number;
  isFocused:    boolean;
  onChangeText: (id: string, text: string) => void;
  onFocus:      (id: string) => void;
  onEnterPress: (id: string) => void;   // Enter → tạo block mới
  onBackspace:  (id: string) => void;   // Backspace khi rỗng → xóa block
  onToggleCheck:(id: string) => void;   // Toggle checkbox
}

// Style text theo loại block
const getTextStyle = (type: Block['type']) => {
  switch (type) {
    case 'heading1': return styles.h1;
    case 'heading2': return styles.h2;
    case 'heading3': return styles.h3;
    case 'quote':    return styles.quote;
    default:         return styles.bodyText;
  }
};

// Prefix hiển thị trước text
const BlockPrefix = ({
  block,
  index,
  onToggle,
}: {
  block: Block;
  index: number;
  onToggle: () => void;
}) => {
  switch (block.type) {
    case 'bullet':
      return <Text style={styles.prefix}>•</Text>;

    case 'numbered':
      return <Text style={styles.prefix}>{index + 1}.</Text>;

    case 'checkbox':
      return (
        <TouchableOpacity onPress={onToggle} style={styles.checkboxBtn}>
          <View style={[styles.checkbox, block.checked && styles.checkboxChecked]}>
            {block.checked && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      );

    case 'quote':
      return <View style={styles.quoteLine} />;

    default:
      return null;
  }
};

export default function BlockItem({
  block, index, isFocused,
  onChangeText, onFocus, onEnterPress,
  onBackspace, onToggleCheck,
}: BlockItemProps) {
  const inputRef = useRef<TextInput>(null);

  // Xử lý phím bấm
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && block.content === '') {
      onBackspace(block.id);
    }
  };

  // Divider không có TextInput
  if (block.type === 'divider') {
    return (
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
      </View>
    );
  }

  const hasPrefix = ['bullet','numbered','checkbox','quote'].includes(block.type);

  return (
    <View style={[styles.row, isFocused && styles.rowFocused]}>
      {/* Prefix: bullet, số, checkbox, quote line */}
      <BlockPrefix
        block={block}
        index={index}
        onToggle={() => onToggleCheck(block.id)}
      />

      {/* TextInput */}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          getTextStyle(block.type),
          block.checked && styles.textChecked,
          hasPrefix && styles.inputWithPrefix,
        ]}
        value={block.content}
        onChangeText={(text) => onChangeText(block.id, text)}
        onFocus={() => onFocus(block.id)}
        onKeyPress={handleKeyPress}
        onSubmitEditing={() => onEnterPress(block.id)}
        placeholder={
          isFocused
            ? block.type === 'text' ? "Nhập nội dung, '/' để chọn block..." : ''
            : ''
        }
        placeholderTextColor={COLORS.textDim}
        multiline={block.type === 'text' || block.type === 'quote'}
        blurOnSubmit={false}   // Enter không đóng keyboard
        returnKeyType="default"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 2,
    minHeight: 36,
  },
  rowFocused: {
    backgroundColor: '#ffffff08',
    borderRadius: 6,
  },

  // TextInput
  input: {
    flex: 1,
    padding: 0,
    color: COLORS.text,
    fontWeight: 700,
  },
  inputWithPrefix: {
    marginLeft: 8,
  },

  // Text styles theo loại block
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    color: COLORS.text,
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    color: COLORS.text,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: COLORS.text,
  },
  quote: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  textChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textDim,
  },

  // Prefix elements
  prefix: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 24,
    minWidth: 20,
    textAlign: 'center',
  },
  checkboxBtn: {
    paddingTop: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  checkmark: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  quoteLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    alignSelf: 'stretch',
    marginRight: 8,
    minHeight: 24,
  },

  // Divider
  dividerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dividerLine: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});