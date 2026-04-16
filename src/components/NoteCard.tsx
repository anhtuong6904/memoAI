import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NoteCardProps, Note } from '../types';
import { COLORS } from '../constants/colors';

const TYPE_CONFIG: Record<Note['type'], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  text:  { icon: 'document-text-outline', color: '#6C63FF', label: 'Ghi chú' },
  image: { icon: 'image-outline',         color: '#3B82F6', label: 'Ảnh'    },
  voice: { icon: 'mic-outline',           color: '#10B981', label: 'Giọng nói' },
  video: { icon: 'videocam-outline',      color: '#F59E0B', label: 'Video'  },
};

const TAG_COLORS = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

function getTagColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)   return 'Vừa xong';
  if (mins  < 60)  return `${mins} phút trước`;
  if (hours < 24)  return `${hours} giờ trước`;
  if (days  < 7)   return `${days} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NoteCard({ note, onPress, onDelete, onHold }: NoteCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const tags: string[] = (() => { try { return JSON.parse(note.tags || '[]'); } catch { return []; } })();
  const typeConf = TYPE_CONFIG[note.type] ?? TYPE_CONFIG.text;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();

  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const handleDelete = () => {
    Alert.alert(
      'Xóa ghi chú',
      'Bạn có chắc muốn xóa ghi chú này không?',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: onDelete },
      ],
    );
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onLongPress={onHold}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: typeConf.color + '22' }]}>
            <Ionicons name={typeConf.icon} size={12} color={typeConf.color} />
            <Text style={[styles.typeLabel, { color: typeConf.color }]}>{typeConf.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(note.created_at)}</Text>
        </View>

        {/* Title / summary */}
        {note.summary ? (
          <Text style={styles.title} numberOfLines={1}>{note.summary}</Text>
        ) : null}

        {/* Content preview */}
        <Text style={styles.preview} numberOfLines={note.summary ? 2 : 3}>
          {note.content}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.tagRow}>
            {tags.slice(0, 3).map((tag, i) => {
              const c = getTagColor(tag);
              return (
                <View key={i} style={[styles.tag, { backgroundColor: c + '20' }]}>
                  <Text style={[styles.tagText, { color: c }]}>#{tag}</Text>
                </View>
              );
            })}
            {tags.length > 3 && (
              <Text style={styles.tagMore}>+{tags.length - 3}</Text>
            )}
          </View>

          {onDelete ? (
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={COLORS.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Accent line */}
        <View style={[styles.accentLine, { backgroundColor: typeConf.color }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textDim,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    paddingLeft: 8,
  },
  preview: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 20,
    paddingLeft: 8,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  tag: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagMore: {
    fontSize: 11,
    color: COLORS.textDim,
    alignSelf: 'center',
  },
});