/**
 * screens/EditScreen.tsx
 * Hỗ trợ: edit/view toggle, markdown render, extracted info panel,
 *          image capture, AI analyze, auto-save.
 */

import { Ionicons }               from '@expo/vector-icons';
import { useFocusEffect }         from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker           from 'expo-image-picker';
import MarkdownDisplay            from 'react-native-markdown-display';
import React, {
  useCallback, useEffect, useLayoutEffect,
  useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Image,
  Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, Share, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BlockItem         from '../components/BlockEditor/BlockItem';
import SlashMenu         from '../components/BlockEditor/SlashMenu';
import { COLORS }        from '../constants/colors';
import { useNoteDetail } from '../hooks/useNotes';
import {
  captureImage, captureText,
  deleteNote,   updateNote,
} from '../services/api';
import { Block, BlockType, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Edit'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `b_${Date.now()}_${_uid++}`;

function textToBlocks(text: string): Block[] {
  if (!text.trim()) return [{ id: uid(), type: 'text', content: '' }];
  return text.split('\n').map((line): Block => {
    if (/^### /.test(line))       return { id: uid(), type: 'heading3',  content: line.slice(4) };
    if (/^## /.test(line))        return { id: uid(), type: 'heading2',  content: line.slice(3) };
    if (/^# /.test(line))         return { id: uid(), type: 'heading1',  content: line.slice(2) };
    if (/^- \[x\] /i.test(line))  return { id: uid(), type: 'checkbox',  content: line.slice(6), checked: true  };
    if (/^- \[ \] /.test(line))   return { id: uid(), type: 'checkbox',  content: line.slice(6), checked: false };
    if (/^- /.test(line))         return { id: uid(), type: 'bullet',    content: line.slice(2) };
    if (/^\d+\. /.test(line)) {
      const m = line.match(/^\d+\. (.*)/);
      return { id: uid(), type: 'numbered', content: m ? m[1] : line };
    }
    if (/^> /.test(line))          return { id: uid(), type: 'quote',   content: line.slice(2) };
    if (/^---$/.test(line.trim())) return { id: uid(), type: 'divider', content: '' };
    return { id: uid(), type: 'text', content: line };
  });
}

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
  try { return JSON.parse(raw); } catch { return []; }
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const LIST_TYPES: BlockType[] = ['bullet', 'numbered', 'checkbox'];

const TOOLBAR_ITEMS: { id: BlockType | 'divider'; label: string }[] = [
  { id: 'heading1', label: 'H1' }, { id: 'heading2', label: 'H2' },
  { id: 'heading3', label: 'H3' }, { id: 'bullet',   label: '•'  },
  { id: 'numbered', label: '1.' }, { id: 'checkbox', label: '☐'  },
  { id: 'quote',    label: '"'  }, { id: 'divider',  label: '—'  },
];

// ── Markdown styles ───────────────────────────────────────────────────────────
const mdStyles = {
  body:         { color: COLORS.text,    fontSize: 15, lineHeight: 24 },
  heading1:     { color: COLORS.text,    fontSize: 26, fontWeight: '800' as const, marginBottom: 8,  marginTop: 12 },
  heading2:     { color: COLORS.text,    fontSize: 22, fontWeight: '700' as const, marginBottom: 6,  marginTop: 10 },
  heading3:     { color: COLORS.text,    fontSize: 18, fontWeight: '600' as const, marginBottom: 4,  marginTop: 8  },
  bullet_list:  { color: COLORS.text    },
  ordered_list: { color: COLORS.text    },
  list_item:    { color: COLORS.text,    fontSize: 15, lineHeight: 24 },
  blockquote:   {
    backgroundColor: COLORS.surface,
    borderLeftColor: COLORS.accent, borderLeftWidth: 3,
    paddingLeft: 12, paddingVertical: 4, marginVertical: 6,
  },
  code_inline: {
    backgroundColor: COLORS.surface, color: COLORS.accent,
    borderRadius: 4, paddingHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13,
  },
  fence: {
    backgroundColor: COLORS.surface, borderRadius: 8,
    padding: 12, marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13,
  },
  hr:        { backgroundColor: COLORS.border, height: 1, marginVertical: 12 },
  link:      { color: COLORS.accent },
  paragraph: { marginBottom: 8, color: COLORS.text },
  strong:    { color: COLORS.text,    fontWeight: '700' as const },
  em:        { color: COLORS.textMuted, fontStyle: 'italic' as const },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditScreen({ route, navigation }: Props) {
  const noteId = route.params?.noteId;
  const isNew  = noteId === undefined;

  const { note, extracted, loading: noteLoading, reload: reloadNote } = useNoteDetail(noteId);

  // isEditing:
  //   isNew = true  → true  (mở editor ngay)
  //   isNew = false → false (xem markdown trước, tap để edit)
  const [isEditing,     setIsEditing]     = useState(isNew);
  const [saving,        setSaving]        = useState(false);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [title,         setTitle]         = useState('');
  const [blocks,        setBlocks]        = useState<Block[]>([{ id: uid(), type: 'text', content: '' }]);
  const [focusedId,     setFocusedId]     = useState<string | null>(null);
  const [tags,          setTags]          = useState<string[]>([]);
  const [tagInput,      setTagInput]      = useState('');
  const [showTagInput,  setShowTagInput]  = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [slashVisible,  setSlashVisible]  = useState(false);
  const [slashQuery,    setSlashQuery]    = useState('');
  const [slashBlockId,  setSlashBlockId]  = useState<string | null>(null);

  const titleRef     = useRef<TextInput>(null);
  const isDirty      = useRef(false);
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOpacity = useRef(new Animated.Value(0)).current;

  // ── Sync khi note load xong ───────────────────────────────────────────────
  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? '');
    setBlocks(textToBlocks(note.content));
    setTags(parseTags(note.tags));
    setIsEditing(false);  // note cũ load xong → view mode
  }, [note]);

  useFocusEffect(useCallback(() => { reloadNote(); }, [reloadNote]));

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => titleRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', e => {
      if (!isDirty.current) return;
      e.preventDefault();
      doSave(false).then(() => navigation.dispatch(e.data.action));
    });
    return unsub;
  }, [navigation, title, blocks, tags]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const flashSaved = () => {
    Animated.sequence([
      Animated.timing(savedOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(savedOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const doSave = useCallback(async (showSpinner: boolean) => {
    const content = blocksToText(blocks).trim();
    if (!title.trim() && !content) return;
    try {
      if (showSpinner) setSaving(true);
      if (isNew) {
        // captureText → AI xử lý → tạo note + extracted_info
        await captureText(content || ' ');
      } else if (note) {
        await updateNote(note.id, {
          title:   title || '',
          content: content || ' ',
          tags:    JSON.stringify(tags),
        });
      }
      isDirty.current = false;
      flashSaved();
      // Sau khi lưu → quay về view mode
      if (!isNew) setIsEditing(false);
    } catch (e) {
      if (showSpinner)
        Alert.alert('Lỗi', e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      if (showSpinner) setSaving(false);
    }
  }, [blocks, isNew, note, tags, title]);

  const markDirty = () => {
    isDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(false), 1200);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (isNew) { navigation.goBack(); return; }
    Alert.alert('Xóa ghi chú', 'Không thể khôi phục. Tiếp tục?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          if (!note) return;
          await deleteNote(note.id);
          isDirty.current = false;
          navigation.goBack();
        },
      },
    ]);
  };

  // ── Share ─────────────────────────────────────────────────────────────────

  const handleShare = () =>
    Share.share({ message: `${title}\n\n${blocksToText(blocks)}`.trim() });

  // ── AI Analyze — re-run pipeline thủ công ────────────────────────────────

  const handleAnalyze = async () => {
    if (!note) return;
    setAnalyzing(true);
    try {
      await captureText(blocksToText(blocks).trim());
      await reloadNote();
      setShowExtracted(true);  // tự mở panel sau khi analyze xong
    } catch {
      Alert.alert('Lỗi', 'Không thể phân tích. Kiểm tra backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Attach ────────────────────────────────────────────────────────────────

  const handleAttach = () => {
    Keyboard.dismiss();
    Alert.alert('Đính kèm', '', [
      {
        text: '🖼️  Chụp / Chọn ảnh',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
          });
          if (!res.canceled && res.assets[0]) {
            setSaving(true);
            try {
              await captureImage(res.assets[0].uri);
              Alert.alert('✅ Thành công', 'Ảnh đã được AI xử lý và lưu thành ghi chú mới');
            } catch {
              Alert.alert('Lỗi', 'Không thể xử lý ảnh. Kiểm tra backend đang chạy không.');
            } finally {
              setSaving(false);
            }
          }
        },
      },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  // ── Block editing ─────────────────────────────────────────────────────────

  const changeBlockText = (id: string, text: string) => {
    markDirty();
    if (text.endsWith('/') && !slashVisible) {
      setSlashBlockId(id); setSlashQuery(''); setSlashVisible(true);
    } else if (slashVisible && slashBlockId === id) {
      const idx = text.lastIndexOf('/');
      idx >= 0 ? setSlashQuery(text.slice(idx + 1)) : setSlashVisible(false);
    }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: text } : b));
  };

  const enterPress = (id: string) => {
    markDirty();
    const idx  = blocks.findIndex(b => b.id === id);
    const curr = blocks[idx];
    if (LIST_TYPES.includes(curr.type) && curr.content === '') {
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'text' } : b));
      return;
    }
    const newBlock: Block = {
      id: uid(), type: LIST_TYPES.includes(curr.type) ? curr.type : 'text',
      content: '', checked: false,
    };
    const next = [...blocks]; next.splice(idx + 1, 0, newBlock);
    setBlocks(next); setFocusedId(newBlock.id);
  };

  const backspaceEmpty = (id: string) => {
    if (blocks.length <= 1) return;
    markDirty();
    const idx  = blocks.findIndex(b => b.id === id);
    const prev = blocks[idx - 1];
    setBlocks(blocks.filter(b => b.id !== id));
    if (prev) setFocusedId(prev.id);
  };

  const toggleCheck = (id: string) => {
    markDirty();
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, checked: !b.checked } : b));
  };

  const applySlashCommand = (type: BlockType) => {
    if (!slashBlockId) return;
    markDirty();
    setBlocks(prev => prev.map(b => {
      if (b.id !== slashBlockId) return b;
      const si = b.content.lastIndexOf('/');
      return { ...b, type, content: si >= 0 ? b.content.slice(0, si) : b.content };
    }));
    setSlashVisible(false); setSlashBlockId(null); setSlashQuery('');
  };

  const applyFormat = (type: BlockType | 'divider') => {
    markDirty();
    if (type === 'divider') {
      const nb: Block = { id: uid(), type: 'divider', content: '' };
      if (focusedId) {
        const idx = blocks.findIndex(b => b.id === focusedId);
        const next = [...blocks]; next.splice(idx + 1, 0, nb); setBlocks(next);
      } else setBlocks(prev => [...prev, nb]);
      return;
    }
    if (!focusedId) {
      const nb: Block = { id: uid(), type, content: '' };
      setBlocks(prev => [...prev, nb]); setFocusedId(nb.id); return;
    }
    setBlocks(prev => prev.map(b =>
      b.id === focusedId ? { ...b, type: b.type === type ? 'text' : type } : b
    ));
  };

  // ── Tags ──────────────────────────────────────────────────────────────────

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); markDirty(); }
    setTagInput(''); setShowTagInput(false);
  };

  const removeTag = (t: string) => {
    setTags(prev => prev.filter(x => x !== t)); markDirty();
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (noteLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const focusedBlock    = blocks.find(b => b.id === focusedId);
  const markdownContent = blocksToText(blocks);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >

        {/* ── TOP BAR ────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.backBtn} onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
            <Text style={s.backLabel}>Ghi chú</Text>
          </TouchableOpacity>

          <View style={s.topCenter} pointerEvents="none">
            {saving
              ? <ActivityIndicator size="small" color={COLORS.textDim} />
              : <>
                  <Animated.Text style={[s.savedBadge, { opacity: savedOpacity }]}>✓ Đã lưu</Animated.Text>
                  <Text style={s.dateText}>{note ? fmtDate(note.updated_at) : 'Ghi chú mới'}</Text>
                </>
            }
          </View>

          <View style={s.topRight}>
            {/* Toggle extracted panel — chỉ hiện khi có data */}
            {extracted && (
              <TouchableOpacity style={s.topBtn} onPress={() => setShowExtracted(v => !v)}>
                <Ionicons
                  name="sparkles-outline" size={19}
                  color={showExtracted ? COLORS.accent : COLORS.textMuted}
                />
              </TouchableOpacity>
            )}

            {/* Re-run AI analyze */}
            {!isNew && (
              <TouchableOpacity style={s.topBtn} onPress={handleAnalyze} disabled={analyzing}>
                {analyzing
                  ? <ActivityIndicator size="small" color={COLORS.accent} />
                  : <Ionicons name="sparkles" size={19} color={COLORS.accent} />
                }
              </TouchableOpacity>
            )}

            {!isNew && (
              <TouchableOpacity style={s.topBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={19} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.topBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SCROLL CONTENT ─────────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.editorPad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Media preview */}
          {note?.type === 'image' && (note as any).file_url && (
            <Image source={{ uri: (note as any).file_url }} style={s.mediaImg} resizeMode="cover" />
          )}
          {note?.type === 'voice' && (note as any).file_url && (
            <View style={s.audioChip}>
              <Ionicons name="mic" size={16} color={COLORS.accent} />
              <Text style={s.audioLabel}>Ghi âm · nhấn để nghe</Text>
            </View>
          )}

          {/* AI Extracted Info Panel */}
          {showExtracted && extracted && (
            <View style={s.extractedCard}>
              <Text style={s.extractedTitle}>🤖 Thông tin AI trích xuất</Text>
              {extracted.person_name   && <ExtractedRow icon="👤" value={extracted.person_name} />}
              {extracted.phone         && <ExtractedRow icon="📞" value={extracted.phone} />}
              {extracted.email         && <ExtractedRow icon="✉️" value={extracted.email} />}
              {extracted.organization  && <ExtractedRow icon="🏢" value={extracted.organization} />}
              {extracted.address       && <ExtractedRow icon="📍" value={extracted.address} />}
              {extracted.event_title   && (
                <ExtractedRow icon="📅" value={
                  extracted.event_title +
                  (extracted.event_time
                    ? `  ·  ${new Date(extracted.event_time).toLocaleString('vi-VN')}`
                    : '')
                } />
              )}
              {extracted.deadline && (
                <ExtractedRow icon="⏰"
                  value={`Deadline: ${new Date(extracted.deadline).toLocaleDateString('vi-VN')}`}
                />
              )}
              {extracted.action_items && extracted.action_items !== '[]' && (
                <ExtractedRow icon="✅"
                  value={(JSON.parse(extracted.action_items) as string[]).join(' · ')}
                />
              )}
            </View>
          )}

          {/* ── Title ── */}
          {isEditing ? (
            <TextInput
              ref={titleRef}
              style={s.titleInput}
              value={title}
              onChangeText={t => { setTitle(t); markDirty(); }}
              placeholder="Tiêu đề"
              placeholderTextColor={COLORS.textDim}
              multiline returnKeyType="next" blurOnSubmit
              onSubmitEditing={() => { if (blocks[0]) setFocusedId(blocks[0].id); }}
            />
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.8}>
              <Text style={[s.titleInput, !title && { color: COLORS.textDim }]}>
                {title || 'Tiêu đề'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Tags ── */}
          <View style={s.tagsRow}>
            {tags.map(t => (
              <TouchableOpacity
                key={t} style={s.tagChip}
                onPress={() => { if (isEditing) removeTag(t); }}
                activeOpacity={0.7}
              >
                <Text style={s.tagChipText}>#{t}</Text>
                {isEditing && <Text style={s.tagChipX}> ✕</Text>}
              </TouchableOpacity>
            ))}
            {isEditing && (
              <TouchableOpacity style={s.tagAddBtn} onPress={() => setShowTagInput(v => !v)}>
                <Ionicons name="pricetag-outline" size={11} color={COLORS.textDim} />
                <Text style={s.tagAddText}>tag</Text>
              </TouchableOpacity>
            )}
          </View>

          {showTagInput && isEditing && (
            <View style={s.tagInputRow}>
              <TextInput
                style={s.tagField} value={tagInput} onChangeText={setTagInput}
                placeholder="#tên-tag" placeholderTextColor={COLORS.textDim}
                onSubmitEditing={addTag} returnKeyType="done"
                autoCapitalize="none" autoFocus
              />
              <TouchableOpacity style={s.tagConfirmBtn} onPress={addTag}>
                <Text style={s.tagConfirmText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.hairline} />

          {/* ── CONTENT: Edit mode vs View mode ── */}
          {isEditing ? (
            <>
              {blocks.map((block, index) => (
                <BlockItem
                  key={block.id} block={block} index={index}
                  isFocused={focusedId === block.id}
                  onChangeText={changeBlockText} onFocus={setFocusedId}
                  onEnterPress={enterPress} onBackspace={backspaceEmpty}
                  onToggleCheck={toggleCheck}
                />
              ))}
              <TouchableOpacity
                style={s.tapZone} activeOpacity={1}
                onPress={() => { const last = blocks[blocks.length - 1]; if (last) setFocusedId(last.id); }}
              />
            </>
          ) : (
            // View mode — tap để switch sang edit
            <TouchableOpacity
              style={s.markdownWrapper}
              activeOpacity={1}
              onPress={() => setIsEditing(true)}
            >
              <MarkdownDisplay style={mdStyles}>
                {markdownContent || '_Nhấn để bắt đầu viết..._'}
              </MarkdownDisplay>
            </TouchableOpacity>
          )}
        </ScrollView>

        {slashVisible && (
          <SlashMenu query={slashQuery} onSelect={applySlashCommand} onClose={() => setSlashVisible(false)} />
        )}

        {/* ── BOTTOM TOOLBAR — chỉ hiện khi đang edit ── */}
        {isEditing && (
          <View style={s.toolbar}>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.toolbarItems}
              keyboardShouldPersistTaps="always"
            >
              {TOOLBAR_ITEMS.map(item => {
                const active = focusedBlock?.type === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.toolBtn, active && s.toolBtnActive]}
                    onPress={() => applyFormat(item.id as BlockType | 'divider')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.toolBtnText, active && s.toolBtnTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={s.toolSep} />
            <View style={s.toolRight}>
              <TouchableOpacity style={s.toolIconBtn} onPress={handleAttach}>
                <Ionicons name="attach" size={21} color={COLORS.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.doneBtn, saving && s.doneBtnDim]}
                onPress={() => { if (saveTimer.current) clearTimeout(saveTimer.current); doSave(true); }}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.doneBtnText}>Lưu</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-component: ExtractedRow ───────────────────────────────────────────────

function ExtractedRow({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={s.extractedRow}>
      <Text style={s.extractedIcon}>{icon}</Text>
      <Text style={s.extractedValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  backBtn:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2, minWidth: 80 },
  backLabel: { fontSize: 16, color: COLORS.accent, fontWeight: '400' },
  topCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateText:  { fontSize: 12, color: COLORS.textDim },
  savedBadge: { fontSize: 12, color: COLORS.success, fontWeight: '600', position: 'absolute' },
  topRight:  { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 80, justifyContent: 'flex-end' },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },

  editorPad: { paddingBottom: 24 },
  mediaImg:  { width: '100%', height: 220, marginBottom: 16 },

  audioChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.surface, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  audioLabel: { fontSize: 13, color: COLORS.textMuted },

  extractedCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.accent + '40',
  },
  extractedTitle: { fontSize: 12, color: COLORS.accent, fontWeight: '700', marginBottom: 10 },
  extractedRow:   { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  extractedIcon:  { fontSize: 14, width: 22 },
  extractedValue: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 20 },

  titleInput: {
    fontSize: 28, fontWeight: '800', color: COLORS.text,
    lineHeight: 36, letterSpacing: -0.5,
    paddingHorizontal: 16, paddingVertical: 8,
  },

  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingBottom: 8, minHeight: 28,
  },
  tagChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.active, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagChipText: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  tagChipX:    { fontSize: 10, color: COLORS.accent, opacity: 0.6 },
  tagAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  tagAddText: { fontSize: 12, color: COLORS.textDim },
  tagInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  tagField: {
    flex: 1, height: 36, backgroundColor: COLORS.surface,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, fontSize: 13, color: COLORS.text,
  },
  tagConfirmBtn:  { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.accent, borderRadius: 10 },
  tagConfirmText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  hairline:        { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: 8 },
  markdownWrapper: { paddingHorizontal: 16, paddingBottom: 40, minHeight: 200 },
  tapZone:         { minHeight: 160 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8, paddingVertical: 8, gap: 8,
  },
  toolbarItems:    { alignItems: 'center', gap: 4 },
  toolBtn: {
    width: 36, height: 36, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  toolBtnActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  toolBtnText:       { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  toolBtnTextActive: { color: '#fff' },
  toolSep:    { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: COLORS.border },
  toolRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolIconBtn: {
    width: 36, height: 36, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  doneBtn:     { height: 36, paddingHorizontal: 16, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  doneBtnDim:  { opacity: 0.5 },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});