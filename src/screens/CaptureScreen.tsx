// src/screens/CaptureScreen.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { COLORS } from '../constants/colors';
import { Block, BlockType } from '../types';
import BlockItem from '../components/BlockEditor/BlockItem';
import SlashMenu from '../components/BlockEditor/SlashMenu';

// ── API imports — khớp với routes/notes.js ──────────────────
import {
  createNote,    // POST /api/notes        → type 'text'
  uploadImage,   // POST /api/notes/image  → type 'image'
  uploadAudio,   // POST /api/notes/audio  → type 'voice'
  uploadVideo,   // POST /api/notes/video  → type 'video'
} from '../services/api';

// ── Helper tạo block ─────────────────────────────────────────
const createBlock = (type: BlockType = 'text', content = ''): Block => ({
  id:      `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type,
  content,
  checked: false,
});

// ── Chuyển blocks → string lưu vào cột content (TEXT) ────────
// Khớp với schema: content TEXT NOT NULL
const blocksToContent = (title: string, blocks: Block[]): string => {
  const titleLine  = title.trim() ? `# ${title.trim()}\n\n` : '';
  const bodyLines  = blocks
    .map(b => {
      switch (b.type) {
        case 'heading1': return `# ${b.content}`;
        case 'heading2': return `## ${b.content}`;
        case 'heading3': return `### ${b.content}`;
        case 'bullet':   return `• ${b.content}`;
        case 'numbered': return `1. ${b.content}`;
        case 'checkbox': return `[${b.checked ? 'x' : ' '}] ${b.content}`;
        case 'quote':    return `> ${b.content}`;
        case 'divider':  return '---';
        default:         return b.content;
      }
    })
    .join('\n');
  return titleLine + bodyLines;
};

export default function CaptureScreen() {
  // ── State ──────────────────────────────────────────────────
  const [title, setTitle]   = useState('');
  const [blocks, setBlocks] = useState<Block[]>([createBlock()]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isSaving, setIsSaving]   = useState(false);

  // Slash menu
  const [showSlash, setShowSlash]   = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const slashTargetId = useRef<string | null>(null);

  // Date/Time
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startTime, setStartTime]       = useState<Date | null>(null);
  const [endTime, setEndTime]           = useState<Date | null>(null);
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker,   setShowEndPicker]   = useState(false);

  // Recording
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // ── Block operations ───────────────────────────────────────
  const handleChangeText = useCallback((id: string, text: string) => {
    if (text.endsWith('/')) {
      slashTargetId.current = id;
      setSlashQuery('');
      setShowSlash(true);
      setBlocks(prev =>
        prev.map(b => b.id === id ? { ...b, content: text.slice(0, -1) } : b)
      );
      return;
    }
    if (showSlash && slashTargetId.current === id) {
      setSlashQuery(text.split('/').pop() ?? '');
    }
    setBlocks(prev =>
      prev.map(b => b.id === id ? { ...b, content: text } : b)
    );
  }, [showSlash]);

  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!slashTargetId.current) return;
    if (type === 'divider') {
      setBlocks(prev => {
        const idx  = prev.findIndex(b => b.id === slashTargetId.current);
        const next = [...prev];
        next.splice(idx + 1, 0, createBlock('divider'));
        next.splice(idx + 2, 0, createBlock('text'));
        return next;
      });
    } else {
      setBlocks(prev =>
        prev.map(b =>
          b.id === slashTargetId.current ? { ...b, type, content: '' } : b
        )
      );
    }
    setShowSlash(false);
    slashTargetId.current = null;
  }, []);

  const handleEnterPress = useCallback((id: string) => {
    const cur = blocks.find(b => b.id === id);
    const nextType: BlockType =
      ['bullet', 'numbered', 'checkbox'].includes(cur?.type ?? '')
        ? (cur!.type as BlockType)
        : 'text';
    const nb = createBlock(nextType);
    setBlocks(prev => {
      const idx  = prev.findIndex(b => b.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, nb);
      return next;
    });
    setFocusedId(nb.id);
  }, [blocks]);

  const handleBackspace = useCallback((id: string) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev;
      const idx  = prev.findIndex(b => b.id === id);
      const next = prev.filter(b => b.id !== id);
      setFocusedId(next[Math.max(0, idx - 1)]?.id ?? null);
      return next;
    });
  }, []);

  const handleToggleCheck = useCallback((id: string) => {
    setBlocks(prev =>
      prev.map(b => b.id === id ? { ...b, checked: !b.checked } : b)
    );
  }, []);

  // ── Date/Time ──────────────────────────────────────────────
  const formatDate = (d: Date) => d.toLocaleDateString('vi-VN');
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const handleConfirmDate  = (d: Date) => { setSelectedDate(d); setShowDatePicker(false);  };
  const handleConfirmStart = (t: Date) => { setStartTime(t);    setShowStartPicker(false); };
  const handleConfirmEnd   = (t: Date) => {
    if (startTime && t <= startTime) {
      Alert.alert('Lỗi', 'Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    setEndTime(t);
    setShowEndPicker(false);
  };

  // ── Upload ảnh — POST /api/notes/image ─────────────────────
  const handlePickImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền', 'Vui lòng cấp quyền camera');
      return;
    }

    // Cho chọn: camera hoặc thư viện
    Alert.alert('Chọn ảnh', '', [
      {
        text: 'Chụp ảnh',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled) await saveImageNote(result.assets[0].uri);
        },
      },
      {
        text: 'Thư viện',
        onPress: async () => {
          const r2 = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!r2.canceled) await saveImageNote(r2.assets[0].uri);
        },
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  // Gọi uploadImage → POST /api/notes/image
  // Server nhận: field 'image', mimetype image/jpeg
  // Server trả:  Note { id, content: 'Đang xử lý ảnh...', type: 'image', file_path: URL }
  const saveImageNote = async (uri: string) => {
    try {
      setIsSaving(true);
      const note = await uploadImage(uri);
      Alert.alert('✅ Đã lưu', `Ảnh đã upload (id: ${note.id})`);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message ?? 'Upload ảnh thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Ghi âm — POST /api/notes/audio ────────────────────────
  const handleToggleRecording = async () => {
    if (isRecording) {
      // Dừng ghi âm → upload
      await stopAndSaveAudio();
    } else {
      // Bắt đầu ghi âm
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần quyền', 'Vui lòng cấp quyền microphone');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm');
    }
  };

  // Dừng → lấy uri → gọi uploadAudio → POST /api/notes/audio
  // Server nhận: field 'audio', mimetype audio/x-m4a
  // Server trả:  Note { id, content: 'Đang xử lý âm thanh...', type: 'voice', file_path: URL }
  const stopAndSaveAudio = async () => {
    if (!recordingRef.current) return;
    try {
      setIsSaving(true);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (uri) {
        const note = await uploadAudio(uri);
        Alert.alert('✅ Đã lưu', `Ghi âm đã upload (id: ${note.id})`);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message ?? 'Upload âm thanh thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Lưu ghi chú text — POST /api/notes ────────────────────
  // Gửi: { content: string, type: 'text' }
  // content = title + blocks ghép thành chuỗi markdown
  // Server lưu vào cột: content TEXT NOT NULL, type TEXT, tags '[]'
  const handleSave = async () => {
    const content = blocksToContent(title, blocks);

    if (!content.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung');
      return;
    }

    try {
      setIsSaving(true);

      // Thêm thông tin date/time vào cuối content nếu có
      let fullContent = content;
      if (selectedDate || startTime) {
        fullContent += '\n\n---';
        if (selectedDate) fullContent += `\n📅 ${formatDate(selectedDate)}`;
        if (startTime)    fullContent += `\n⏰ ${formatTime(startTime)}`;
        if (endTime)      fullContent += ` → ${formatTime(endTime)}`;
      }

      // Gọi createNote → POST /api/notes
      // api.ts: api.post('/notes', { content, type: 'text' })
      const note = await createNote(fullContent);

      Alert.alert('✅ Đã lưu', `Ghi chú đã tạo (id: ${note.id})`, [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setTitle('');
            setBlocks([createBlock()]);
            setSelectedDate(null);
            setStartTime(null);
            setEndTime(null);
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message ?? 'Lưu ghi chú thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerHint}>Tạo ghi chú</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Lưu</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tiêu đề */}
          <TextInput
            style={styles.titleInput}
            placeholder="Tiêu đề..."
            placeholderTextColor={COLORS.textDim}
            value={title}
            onChangeText={setTitle}
            multiline
          />

          {/* Properties: date/time */}
          <View style={styles.propsRow}>
            <TouchableOpacity
              style={styles.propChip}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.propIcon}>📅</Text>
              <Text style={styles.propText}>
                {selectedDate ? formatDate(selectedDate) : 'Ngày'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.propChip}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={styles.propIcon}>⏰</Text>
              <Text style={styles.propText}>
                {startTime ? formatTime(startTime) : 'Bắt đầu'}
              </Text>
            </TouchableOpacity>

            {startTime && (
              <TouchableOpacity
                style={styles.propChip}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.propIcon}>⏱️</Text>
                <Text style={styles.propText}>
                  {endTime ? formatTime(endTime) : 'Kết thúc'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* Block list */}
          {blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              isFocused={focusedId === block.id}
              onChangeText={handleChangeText}
              onFocus={setFocusedId}
              onEnterPress={handleEnterPress}
              onBackspace={handleBackspace}
              onToggleCheck={handleToggleCheck}
            />
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Slash Menu */}
        {showSlash && (
          <SlashMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => { setShowSlash(false); slashTargetId.current = null; }}
          />
        )}

        {/* Bottom toolbar */}
        {!showSlash && (
          <View style={styles.toolbar}>

            {/* Camera — POST /api/notes/image */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handlePickImage}
              disabled={isSaving}
            >
              <Text style={styles.toolIcon}>📷</Text>
              <Text style={styles.toolLabel}>Ảnh</Text>
            </TouchableOpacity>

            {/* Ghi âm — POST /api/notes/audio */}
            <TouchableOpacity
              style={[styles.toolBtn, isRecording && styles.toolBtnRecording]}
              onPress={handleToggleRecording}
              disabled={isSaving}
            >
              <Text style={styles.toolIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
              <Text style={[styles.toolLabel, isRecording && { color: COLORS.danger }]}>
                {isRecording ? 'Dừng' : 'Ghi âm'}
              </Text>
            </TouchableOpacity>

            <View style={styles.toolSeparator} />

            {/* Slash block */}
            <TouchableOpacity
              style={[styles.toolBtn, styles.slashBtn]}
              onPress={() => {
                if (focusedId) {
                  const cur = blocks.find(b => b.id === focusedId);
                  handleChangeText(focusedId, (cur?.content ?? '') + '/');
                }
              }}
            >
              <Text style={[styles.toolIcon, { color: COLORS.accent }]}>/</Text>
              <Text style={[styles.toolLabel, { color: COLORS.accent }]}>Block</Text>
            </TouchableOpacity>

          </View>
        )}
      </KeyboardAvoidingView>

      {/* Pickers */}
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={() => setShowDatePicker(false)}
      />
      <DateTimePickerModal
        isVisible={showStartPicker}
        mode="time"
        onConfirm={handleConfirmStart}
        onCancel={() => setShowStartPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showEndPicker}
        mode="time"
        onConfirm={handleConfirmEnd}
        onCancel={() => setShowEndPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerHint: {
    fontSize: 13,
    color:    COLORS.textDim,
  },
  saveBtn: {
    backgroundColor:  COLORS.accent,
    borderRadius:     20,
    paddingHorizontal: 16,
    paddingVertical:   6,
    minWidth:          60,
    alignItems:        'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#fff',
  },
  titleInput: {
    fontSize:          26,
    fontWeight:        '700',
    color:             COLORS.text,
    paddingHorizontal: 16,
    paddingVertical:   12,
    lineHeight:        34,
  },
  propsRow: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: 16,
    gap:               8,
    marginBottom:      8,
  },
  propChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   COLORS.surface,
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  propIcon: { fontSize: 13 },
  propText: {
    fontSize: 13,
    color:    COLORS.textMuted,
  },
  divider: {
    height:           1,
    backgroundColor:  COLORS.border,
    marginHorizontal: 16,
    marginBottom:     8,
  },
  toolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderTopWidth:    1,
    borderTopColor:    COLORS.border,
    gap:               4,
  },
  toolBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:    10,
    gap:             2,
  },
  toolBtnRecording: {
    backgroundColor: COLORS.danger + '20',
    borderWidth:     1,
    borderColor:     COLORS.danger,
  },
  toolIcon:  { fontSize: 18 },
  toolLabel: {
    fontSize: 10,
    color:    COLORS.textMuted,
  },
  toolSeparator: { flex: 1 },
  slashBtn: {
    flexDirection:   'row',
    gap:             4,
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderColor:     COLORS.accent + '60',
    paddingHorizontal: 14,
  },
});