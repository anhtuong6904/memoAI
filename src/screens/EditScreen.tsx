/**
 * EditScreen — Apple Notes style
 *
 * Dùng cho cả 2 trường hợp:
 *   • noteId === undefined  →  tạo mới (blank note)
 *   • noteId = số           →  mở ghi chú có sẵn để chỉnh sửa
 *
 * UX flow (giống Apple Notes):
 *   - Mở ra là chế độ chỉnh sửa ngay, không cần bấm nút "Edit"
 *   - Bấm ← Back → tự động lưu (create hoặc update)
 *   - Bottom toolbar: formatting + đính kèm + xóa
 *   - Slash menu "/" để chọn loại block
 */

import React, {
  useCallback, useEffect, useLayoutEffect,
  useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image,
  KeyboardAvoidingView, Platform, ScrollView,
  Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView }                    from 'react-native-safe-area-context';
import { useFocusEffect }                  from '@react-navigation/native';
import { NativeStackScreenProps }          from '@react-navigation/native-stack';
import { Ionicons }                        from '@expo/vector-icons';
import * as ImagePicker                    from 'expo-image-picker';

import { COLORS }                          from '../constants/colors';
import { Block, BlockType, Note, RootStackParamList } from '../types';
import {
  createNote, deleteNote, getNoteByID,
  updateNote, uploadImage, uploadVideo,
} from '../services/api';
import BlockItem                           from '../components/BlockEditor/BlockItem';
import SlashMenu                           from '../components/BlockEditor/SlashMenu';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'Edit'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _id = 0;
const uid = () => `b_${Date.now()}_${_id++}`;

/** Chuyển plain-text (markdown-like) → mảng Block */
function textToBlocks(text: string): Block[] {
  if (!text.trim()) return [{ id: uid(), type: 'text', content: '' }];
  return text.split('\n').map(line => {
    if (/^### /.test(line)) return { id: uid(), type: 'heading3' as BlockType, content: line.slice(4) };
    if (/^## /.test(line))  return { id: uid(), type: 'heading2' as BlockType, content: line.slice(3) };
    if (/^# /.test(line))   return { id: uid(), type: 'heading1' as BlockType, content: line.slice(2) };
    if (/^- \[x\] /i.test(line)) return { id: uid(), type: 'checkbox' as BlockType, content: line.slice(6), checked: true };
    if (/^- \[ \] /.test(line))  return { id: uid(), type: 'checkbox' as BlockType, content: line.slice(6), checked: false };
    if (/^- /.test(line))   return { id: uid(), type: 'bullet' as BlockType, content: line.slice(2) };
    if (/^\d+\. /.test(line)) {
      const m = line.match(/^\d+\. (.*)/);
      return { id: uid(), type: 'numbered' as BlockType, content: m ? m[1] : line };
    }
    if (/^> /.test(line))   return { id: uid(), type: 'quote' as BlockType, content: line.slice(2) };
    if (/^---$/.test(line.trim())) return { id: uid(), type: 'divider' as BlockType, content: '' };
    return { id: uid(), type: 'text' as BlockType, content: line };
  });
}

/** Mảng Block → plain-text để lưu vào DB */
function blocksToText(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'heading1': return `# ${b.content}`;
      case 'heading2': return `## ${b.content}`;
      case 'heading3': return `### ${b.content}`;
      case 'bullet':   return `- ${b.content}`;
      case 'numbered': return `1. ${b.content}`;
      case 'checkbox': return b.checked ? `- [x] ${b.content}` : `- [ ] ${b.content}`;
      case 'quote':    return `> ${b.content}`;
      case 'divider':  return '---';
      default:         return b.content;
    }
  }).join('\n');
}

const parseTags = (raw: string): string[] => {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Toolbar item config ─────────────────────────────────────────────────────

interface ToolItem { id: string; label: string; icon?: keyof typeof Ionicons.glyphMap; emoji?: string }

const FORMAT_TOOLS: ToolItem[] = [
  { id: 'heading1', label: 'H1',  emoji: 'H1' },
  { id: 'heading2', label: 'H2',  emoji: 'H2' },
  { id: 'bullet',   label: '•',   emoji: '•'  },
  { id: 'numbered', label: '1.',  emoji: '1.' },
  { id: 'checkbox', label: '☐',   emoji: '☐'  },
  { id: 'quote',    label: '"',   emoji: '"'  },
  { id: 'divider',  label: '—',   emoji: '—'  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditScreen({ route, navigation }: Props) {
  const noteId = route.params?.noteId;        // undefined = new note
  const isNew  = noteId === undefined;

  // ── Data state
  const [note,    setNote]    = useState<Note | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);  // "✓ Đã lưu" flash

  // ── Editor state
  const [title,      setTitle]      = useState('');
  const [blocks,     setBlocks]     = useState<Block[]>([{ id: uid(), type: 'text', content: '' }]);
  const [focusedId,  setFocusedId]  = useState<string | null>(null);
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagInput,   setTagInput]   = useState('');
  const [showTags,   setShowTags]   = useState(false);

  // ── Slash menu state
  const [slashQuery,    setSlashQuery]    = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashBlockId,  setSlashBlockId]  = useState<string | null>(null);

  // ── Refs
  const titleRef  = useRef<TextInput>(null);
  const isDirty   = useRef(false);           // có thay đổi chưa lưu?

  // ── Load note khi mở màn hình có noteId
  const loadNote = useCallback(async () => {
    if (isNew || !noteId) return;
    try {
      setLoading(true);
      const data = await getNoteByID(noteId);
      setNote(data);
      setTitle(data.title ?? '');
      setBlocks(textToBlocks(data.content));
      setTags(parseTags(data.tags));
    } catch {
      Alert.alert('Lỗi', 'Không tải được ghi chú');
    } finally {
      setLoading(false);
    }
  }, [noteId, isNew]);

  useFocusEffect(useCallback(() => { loadNote(); }, [loadNote]));

  // ── Auto-focus title khi tạo mới
  useEffect(() => {
    if (isNew) setTimeout(() => titleRef.current?.focus(), 300);
  }, [isNew]);

  // ── Chặn back → auto-save
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty.current) return;       // không có gì thay đổi → cho về
      e.preventDefault();
      handleSave().then(() => navigation.dispatch(e.data.action));
    });
    return unsub;
  }, [navigation, title, blocks, tags]);

  // ── Header: ngày + nút share + done
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,   // ta tự vẽ top bar
    });
  }, [navigation]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const content = blocksToText(blocks).trim();
    if (!title.trim() && !content) return;   // blank → skip

    try {
      setSaving(true);
      const tagsJson = JSON.stringify(tags);
      if (isNew) {
        await createNote(content, title.trim() || undefined);
      } else if (note) {
        await updateNote(note.id, {
          title: title || '',
          content: content || ' ',
          tags: tagsJson,
        });
      }
      isDirty.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: unknown) {
      Alert.alert('Lỗi lưu', e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }, [blocks, isNew, note, tags, title]);

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (isNew) { navigation.goBack(); return; }
    Alert.alert('Xóa ghi chú', 'Bạn chắc chắn muốn xóa?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          if (!note) return;
          await deleteNote(note.id);
          isDirty.current = false;
          navigation.goBack();
        },
      },
    ]);
  };

  // ─── Share ─────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    const content = blocksToText(blocks);
    await Share.share({ message: `${title}\n\n${content}`.trim() });
  };

  // ─── Block editor helpers ──────────────────────────────────────────────────

  const markDirty = () => { isDirty.current = true; };

  const changeBlockText = (id: string, text: string) => {
    markDirty();
    // Phát hiện slash command "/"
    if (text.endsWith('/')) {
      setSlashBlockId(id);
      setSlashQuery('');
      setShowSlashMenu(true);
    } else if (showSlashMenu && slashBlockId === id) {
      // Tiếp tục gõ sau "/"
      const slashIdx = text.lastIndexOf('/');
      if (slashIdx >= 0) {
        setSlashQuery(text.slice(slashIdx + 1));
      } else {
        setShowSlashMenu(false);
      }
    }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: text } : b));
  };

  const enterPress = (id: string) => {
    markDirty();
    const idx   = blocks.findIndex(b => b.id === id);
    const curr  = blocks[idx];
    // Nếu bullet/numbered/checkbox rỗng → đổi về text (như Apple Notes)
    if (['bullet','numbered','checkbox'].includes(curr.type) && curr.content === '') {
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'text' } : b));
      return;
    }
    const newBlock: Block = {
      id:   uid(),
      type: ['bullet','numbered','checkbox'].includes(curr.type) ? curr.type : 'text',
      content: '',
      checked: false,
    };
    const next = [...blocks];
    next.splice(idx + 1, 0, newBlock);
    setBlocks(next);
    setFocusedId(newBlock.id);
  };

  const backspaceEmpty = (id: string) => {
    if (blocks.length <= 1) return;
    markDirty();
    const idx   = blocks.findIndex(b => b.id === id);
    const prev  = blocks[idx - 1];
    setBlocks(blocks.filter(b => b.id !== id));
    if (prev) setFocusedId(prev.id);
  };

  const toggleCheck = (id: string) => {
    markDirty();
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, checked: !b.checked } : b));
  };

  // ─── Slash menu select ─────────────────────────────────────────────────────

  const applySlashCommand = (type: BlockType) => {
    if (!slashBlockId) return;
    markDirty();
    setBlocks(prev => prev.map(b => {
      if (b.id !== slashBlockId) return b;
      // Xóa phần "/<query>" khỏi content
      const slashIdx = b.content.lastIndexOf('/');
      return { ...b, type, content: slashIdx >= 0 ? b.content.slice(0, slashIdx) : b.content };
    }));
    setShowSlashMenu(false);
    setSlashBlockId(null);
    setSlashQuery('');
  };

  // ─── Format toolbar press ──────────────────────────────────────────────────

  const applyFormat = (type: string) => {
    markDirty();
    if (!focusedId) {
      // Thêm block mới ở cuối
      const newBlock: Block = { id: uid(), type: type as BlockType, content: '' };
      setBlocks(prev => [...prev, newBlock]);
      setFocusedId(newBlock.id);
      return;
    }
    const idx = blocks.findIndex(b => b.id === focusedId);
    const curr = blocks[idx];
    if (curr.type === type) {
      // Toggle: đổi về text
      setBlocks(prev => prev.map(b => b.id === focusedId ? { ...b, type: 'text' } : b));
    } else {
      setBlocks(prev => prev.map(b => b.id === focusedId ? { ...b, type: type as BlockType } : b));
    }
  };

  // ─── Tags ──────────────────────────────────────────────────────────────────

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
      markDirty();
    }
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setTags(prev => prev.filter(x => x !== t));
    markDirty();
  };

  // ─── Attachment ────────────────────────────────────────────────────────────

  const handleAttach = () => {
    Alert.alert('Đính kèm', 'Chọn loại tệp', [
      {
        text: '🖼️ Ảnh',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
          });
          if (!res.canceled && res.assets[0]) {
            setSaving(true);
            try { await uploadImage(res.assets[0].uri); }
            finally { setSaving(false); }
          }
        },
      },
      {
        text: '🎬 Video',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          });
          if (!res.canceled && res.assets[0]) {
            setSaving(true);
            try { await uploadVideo(res.assets[0].uri); }
            finally { setSaving(false); }
          }
        },
      },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ══ TOP BAR ══════════════════════════════════════════════════════ */}
        <View style={styles.topBar}>
          {/* Back */}
          <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          {/* Date / status */}
          <View style={styles.topCenter}>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : saved ? (
              <Text style={styles.savedText}>✓ Đã lưu</Text>
            ) : note ? (
              <Text style={styles.dateText}>{formatDate(note.created_at)}</Text>
            ) : (
              <Text style={styles.dateText}>Ghi chú mới</Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.topActions}>
            {!isNew && (
              <TouchableOpacity style={styles.topBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.topBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ EDITOR AREA ══════════════════════════════════════════════════ */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.editorScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Media preview (existing note with image) */}
          {note?.type === 'image' && note.file_path && (
            <Image
              source={{ uri: note.file_path }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          )}

          {/* Title */}
          <TextInput
            ref={titleRef}
            style={styles.titleInput}
            value={title}
            onChangeText={t => { setTitle(t); markDirty(); }}
            placeholder="Tiêu đề"
            placeholderTextColor={COLORS.textDim}
            multiline
            returnKeyType="next"
            blurOnSubmit
            onSubmitEditing={() => {
              if (blocks[0]) setFocusedId(blocks[0].id);
            }}
          />

          {/* Tags row */}
          <TouchableOpacity
            style={styles.tagsRow}
            onPress={() => setShowTags(v => !v)}
            activeOpacity={0.8}
          >
            {tags.length === 0 ? (
              <Text style={styles.tagPlaceholder}>+ Thêm tag…</Text>
            ) : (
              tags.map(t => (
                <TouchableOpacity
                  key={t}
                  style={styles.tagChip}
                  onPress={() => removeTag(t)}
                >
                  <Text style={styles.tagChipText}>#{t} ✕</Text>
                </TouchableOpacity>
              ))
            )}
          </TouchableOpacity>

          {showTags && (
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInputField}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="tên-tag"
                placeholderTextColor={COLORS.textDim}
                onSubmitEditing={addTag}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
                <Text style={styles.tagAddText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Block editor */}
          {blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              isFocused={focusedId === block.id}
              onChangeText={changeBlockText}
              onFocus={setFocusedId}
              onEnterPress={enterPress}
              onBackspace={backspaceEmpty}
              onToggleCheck={toggleCheck}
            />
          ))}

          {/* Tap vùng trống bên dưới → focus block cuối */}
          <TouchableOpacity
            style={styles.emptyTapArea}
            activeOpacity={1}
            onPress={() => {
              const last = blocks[blocks.length - 1];
              if (last) setFocusedId(last.id);
            }}
          />
        </ScrollView>

        {/* ══ SLASH MENU ════════════════════════════════════════════════════ */}
        {showSlashMenu && (
          <SlashMenu
            query={slashQuery}
            onSelect={applySlashCommand}
            onClose={() => setShowSlashMenu(false)}
          />
        )}

        {/* ══ BOTTOM TOOLBAR ═══════════════════════════════════════════════ */}
        <View style={styles.toolbar}>
          {/* Formatting buttons */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarScroll}
          >
            {FORMAT_TOOLS.map(tool => {
              const focused = blocks.find(b => b.id === focusedId);
              const active  = focused?.type === tool.id;
              return (
                <TouchableOpacity
                  key={tool.id}
                  style={[styles.toolBtn, active && styles.toolBtnActive]}
                  onPress={() => applyFormat(tool.id)}
                >
                  <Text style={[styles.toolBtnText, active && styles.toolBtnTextActive]}>
                    {tool.emoji}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Right actions */}
          <View style={styles.toolbarRight}>
            <TouchableOpacity style={styles.toolIconBtn} onPress={handleAttach}>
              <Ionicons name="attach" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolIconBtn, styles.doneBtn]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.doneBtnText}>Lưu</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  topCenter: {
    flex: 1, alignItems: 'center',
  },
  topActions: { flexDirection: 'row', gap: 6 },
  dateText:   { fontSize: 12, color: COLORS.textDim },
  savedText:  { fontSize: 12, color: COLORS.success, fontWeight: '600' },

  // ── Editor
  editorScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  mediaImage: {
    width: '100%', height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  titleInput: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 34,
    marginBottom: 8,
    padding: 0,
    letterSpacing: -0.3,
  },

  // ── Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
    minHeight: 28,
  },
  tagPlaceholder: { fontSize: 13, color: COLORS.textDim },
  tagChip: {
    backgroundColor: COLORS.active,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tagInputField: {
    flex: 1,
    height: 36,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    fontSize: 13,
    color: COLORS.text,
  },
  tagAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  tagAddText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  emptyTapArea: { minHeight: 120 },

  // ── Bottom toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
  },
  toolbarScroll: { gap: 4, paddingRight: 8 },
  toolBtn: {
    width: 36, height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toolBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  toolBtnText:       { fontSize: 13, color: COLORS.text,    fontWeight: '700' },
  toolBtnTextActive: { fontSize: 13, color: '#fff',          fontWeight: '700' },

  toolbarRight: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  toolIconBtn: {
    width: 36, height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  doneBtn: {
    width: 56,
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  doneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});