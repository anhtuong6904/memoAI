import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { Note, RootStackParamList } from '../types';
import { getNoteByID, deleteNote } from '../services/api';

type NavProp   = NativeStackNavigationProp<RootStackParamList, 'Detail'>;
type RoutePropT = RouteProp<RootStackParamList, 'Detail'>;

const TYPE_CONFIG: Record<Note['type'], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  text:  { icon: 'document-text', color: '#6C63FF', label: 'Ghi chú' },
  image: { icon: 'image',         color: '#3B82F6', label: 'Ảnh'    },
  voice: { icon: 'mic',           color: '#10B981', label: 'Giọng nói' },
  video: { icon: 'videocam',      color: '#F59E0B', label: 'Video'  },
};

const TAG_COLORS = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
function getTagColor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = label.charCodeAt(i) + ((h << 5) - h);
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
  });
}

/* ── Simple markdown-like renderer ── */
function ContentRenderer({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, idx) => {
        if (/^### /.test(line)) return <Text key={idx} style={mdStyles.h3}>{line.slice(4)}</Text>;
        if (/^## /.test(line))  return <Text key={idx} style={mdStyles.h2}>{line.slice(3)}</Text>;
        if (/^# /.test(line))   return <Text key={idx} style={mdStyles.h1}>{line.slice(2)}</Text>;
        if (/^- /.test(line))   return (
          <View key={idx} style={mdStyles.bulletRow}>
            <Text style={mdStyles.bulletDot}>•</Text>
            <Text style={mdStyles.bulletText}>{line.slice(2)}</Text>
          </View>
        );
        if (/^\d+\. /.test(line)) {
          const match = line.match(/^(\d+)\. (.*)/);
          if (match) return (
            <View key={idx} style={mdStyles.bulletRow}>
              <Text style={mdStyles.bulletDot}>{match[1]}.</Text>
              <Text style={mdStyles.bulletText}>{match[2]}</Text>
            </View>
          );
        }
        if (/^> /.test(line)) return (
          <View key={idx} style={mdStyles.quoteBlock}>
            <Text style={mdStyles.quoteText}>{line.slice(2)}</Text>
          </View>
        );
        if (line.trim() === '') return <View key={idx} style={{ height: 8 }} />;
        return <Text key={idx} style={mdStyles.paragraph}>{line}</Text>;
      })}
    </View>
  );
}

export default function DetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { noteId } = route.params;

  const [note, setNote]       = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNoteByID(noteId);
      setNote(data);
    } catch {
      setError('Không tải được ghi chú');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  /* ── actions ── */
  const handleShare = async () => {
    if (!note) return;
    await Share.share({ message: `${note.summary ?? ''}\n\n${note.content}` });
  };

  const handleDelete = () => {
    Alert.alert('Xóa ghi chú', 'Bạn có chắc muốn xóa ghi chú này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(noteId);
          navigation.goBack();
        },
      },
    ]);
  };

  /* ── loading ── */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── error ── */
  if (error || !note) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={52} color={COLORS.danger} />
          <Text style={styles.errorText}>{error ?? 'Không tìm thấy ghi chú'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchNote}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tags: string[]  = (() => { try { return JSON.parse(note.tags || '[]'); } catch { return []; } })();
  const typeConf = TYPE_CONFIG[note.type] ?? TYPE_CONFIG.text;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={[styles.typeBadge, { backgroundColor: typeConf.color + '22' }]}>
          <Ionicons name={typeConf.icon} size={14} color={typeConf.color} />
          <Text style={[styles.typeLabel, { color: typeConf.color }]}>{typeConf.label}</Text>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary / title ── */}
        {note.summary ? (
          <Text style={styles.summary}>{note.summary}</Text>
        ) : null}

        {/* ── Meta ── */}
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={13} color={COLORS.textDim} />
          <Text style={styles.metaText}>{formatFullDate(note.created_at)}</Text>
        </View>

        {/* ── Tags ── */}
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((tag, i) => {
              const c = getTagColor(tag);
              return (
                <View key={i} style={[styles.tag, { backgroundColor: c + '20' }]}>
                  <Text style={[styles.tagText, { color: c }]}>#{tag}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Media preview ── */}
        {(note.type === 'image') && note.file_path ? (
          <View style={styles.mediaBox}>
            <Image
              source={{ uri: note.file_path }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {(note.type === 'voice' || note.type === 'video') && note.file_path ? (
          <View style={styles.mediaCard}>
            <Ionicons
              name={note.type === 'voice' ? 'mic' : 'videocam'}
              size={28}
              color={typeConf.color}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.mediaCardTitle}>
                {note.type === 'voice' ? 'File âm thanh' : 'File video'}
              </Text>
              <Text style={styles.mediaCardSub} numberOfLines={1}>{note.file_path}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Content ── */}
        <View style={styles.contentBox}>
          <ContentRenderer text={note.content} />
        </View>

        {/* ── AI Summary placeholder ── */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Ionicons name="sparkles" size={16} color={COLORS.accent} />
            <Text style={styles.aiTitle}>AI Summary</Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>Beta</Text>
            </View>
          </View>
          <Text style={styles.aiBody}>
            {note.summary
              ? `Tóm tắt: ${note.summary}`
              : 'AI sẽ phân tích và tóm tắt ghi chú này khi bạn kích hoạt tính năng AI...'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Markdown styles ── */
const mdStyles = StyleSheet.create({
  h1:        { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  h2:        { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4, marginTop: 4 },
  h3:        { fontSize: 15, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4, marginTop: 4 },
  paragraph: { fontSize: 15, color: COLORS.text, lineHeight: 24, marginBottom: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  bulletDot: { fontSize: 15, color: COLORS.accent, lineHeight: 24, minWidth: 16 },
  bulletText:{ fontSize: 15, color: COLORS.text, lineHeight: 24, flex: 1 },
  quoteBlock:{ borderLeftWidth: 3, borderLeftColor: COLORS.accent, paddingLeft: 12, marginVertical: 4 },
  quoteText: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic', lineHeight: 22 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  /* top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, flex: 1,
  },
  typeLabel: { fontSize: 12, fontWeight: '700' },
  actionGroup: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  /* scroll */
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  summary: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 8,
    lineHeight: 30,
  },
  meta: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, marginBottom: 12,
  },
  metaText: { fontSize: 12, color: COLORS.textDim },

  /* tags */
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '600' },

  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },

  /* media */
  mediaBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  mediaImage: { width: '100%', height: 220 },
  mediaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16,
  },
  mediaCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  mediaCardSub:   { fontSize: 12, color: COLORS.textDim, marginTop: 2 },

  /* content */
  contentBox: { marginBottom: 20 },

  /* AI card */
  aiCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.accent + '44',
    marginBottom: 8,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiTitle:  { fontSize: 13, fontWeight: '700', color: COLORS.text, flex: 1 },
  aiBadge:  {
    backgroundColor: COLORS.accent + '33',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: { fontSize: 10, color: COLORS.accent, fontWeight: '700' },
  aiBody:      { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },

  /* states */
  loadingText: { fontSize: 14, color: COLORS.textMuted, marginTop: 12 },
  errorText:   { fontSize: 15, color: COLORS.text, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: COLORS.accent, borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});