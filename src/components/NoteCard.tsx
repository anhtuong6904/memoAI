import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { COLORS }       from '../constants/colors';
import { NoteCardProps } from '../types';
import TagPill           from './TagPill';

const parseTags = (raw: string): string[] => {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
};

const TYPE_ICON: Record<string, string> = {
  text:  '📝',
  image: '🖼️',
  voice: '🎙️',
  video: '🎬',
};

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

export default function NoteCard({ note, onPress, onDelete }: NoteCardProps) {
  const tags            = parseTags(note.tags);
  const [showDel, setShowDel] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Xóa ghi chú',
      'Bạn chắc chắn muốn xóa?',
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => setShowDel(false) },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setShowDel(false);
            onDelete?.();
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={() => setShowDel(v => !v)}
      activeOpacity={0.8}
    >
      {/* ── Header row: type icon + date + delete btn ── */}
      <View style={styles.headerRow}>
        <View style={styles.typeChip}>
          <Text style={styles.typeIcon}>{TYPE_ICON[note.type] ?? '📝'}</Text>
          <Text style={styles.typeText}>{note.type}</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.dateText}>{formatShortDate(note.created_at)}</Text>
          {/* Delete button — visible after long press */}
          {showDel && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Title (summary > first line of content) ── */}
      <Text style={styles.title} numberOfLines={2}>
        {note.summary || note.content.split('\n')[0]}
      </Text>

      {/* ── Preview (content body, skip first line if summary exists) ── */}
      {!note.summary && note.content.split('\n').length > 1 && (
        <Text style={styles.preview} numberOfLines={2}>
          {note.content.split('\n').slice(1).join(' ').trim()}
        </Text>
      )}
      {note.summary && (
        <Text style={styles.preview} numberOfLines={2}>
          {note.content}
        </Text>
      )}

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.slice(0, 4).map((tag, i) => (
            <TagPill key={i} label={tag} />
          ))}
          {tags.length > 4 && (
            <Text style={styles.moreTag}>+{tags.length - 4}</Text>
          )}
        </View>
      )}

      {/* ── Long-press hint (only when delete button is showing) ── */}
      {showDel && (
        <Text style={styles.hint}>Nhấn ngoài để đóng · 🗑 để xóa</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.active,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  typeIcon: { fontSize: 11 },
  typeText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Delete button
  deleteBtn: {
    backgroundColor: COLORS.danger + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deleteBtnText: {
    fontSize: 14,
  },

  // Content
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  preview: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    marginBottom: 10,
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  moreTag: {
    color: COLORS.textMuted,
    fontSize: 12,
    alignSelf: 'center',
  },

  // Hint
  hint: {
    fontSize: 11,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
});