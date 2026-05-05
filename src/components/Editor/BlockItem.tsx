/**
 * components/BlockEditor/BlockItem.tsx  — v2
 *
 * Thêm media blocks: image | audio | video | file
 * Mỗi media block render như 1 "card" inline trong editor,
 * có nút xóa (✕) ở góc phải.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Image,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { Block } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(ms?: number): string {
  if (!ms) return '';
  const s   = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BlockItemProps {
  block:         Block;
  numberedIndex: number;
  isFocused:     boolean;
  onChangeText:  (id: string, text: string) => void;
  onFocus:       (id: string) => void;
  onEnterPress:  (id: string) => void;
  onBackspace:   (id: string) => void;
  onToggleCheck: (id: string) => void;
  onDelete:      (id: string) => void;
}

// ── Text style ────────────────────────────────────────────────────────────────

const getTextStyle = (type: Block['type']) => {
  switch (type) {
    case 'heading1': return s.h1;
    case 'heading2': return s.h2;
    case 'heading3': return s.h3;
    case 'quote':    return s.quote;
    default:         return s.bodyText;
  }
};

const getPlaceholder = (type: Block['type']): string => {
  switch (type) {
    case 'heading1': return 'Tiêu đề lớn';
    case 'heading2': return 'Tiêu đề vừa';
    case 'heading3': return 'Tiêu đề nhỏ';
    case 'bullet':   return 'Mục danh sách';
    case 'numbered': return 'Mục đánh số';
    case 'checkbox': return 'Việc cần làm';
    case 'quote':    return 'Trích dẫn...';
    default:         return "Nhập nội dung, '/' để chọn block...";
  }
};

// ── BlockPrefix ───────────────────────────────────────────────────────────────

function BlockPrefix({ block, numberedIndex, onToggle }: {
  block: Block; numberedIndex: number; onToggle: () => void;
}) {
  switch (block.type) {
    case 'bullet':
      return <Text style={s.bullet}>•</Text>;
    case 'numbered':
      return <Text style={s.numberedPrefix}>{numberedIndex}.</Text>;
    case 'checkbox':
      return (
        <TouchableOpacity onPress={onToggle} style={s.checkboxBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={[s.checkbox, block.checked && s.checkboxChecked]}>
            {block.checked && <Text style={s.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      );
    case 'quote':
      return <View style={s.quoteLine} />;
    default:
      return null;
  }
}

// ── Shared: DeleteBtn ─────────────────────────────────────────────────────────

function DeleteBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.mediaDeleteBtn} onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

// ── Media: ImageBlock ─────────────────────────────────────────────────────────

function ImageBlock({ block, onDelete, onChangeText }: {
  block: Block; onDelete: () => void;
  onChangeText: (id: string, t: string) => void;
}) {
  return (
    <View style={s.mediaCard}>
      <DeleteBtn onPress={onDelete} />
      {block.uri ? (
        <Image source={{ uri: block.uri }} style={s.imagePreview} resizeMode="cover" />
      ) : (
        <View style={[s.imagePreview, s.imagePlaceholder]}>
          <Ionicons name="image-outline" size={40} color={COLORS.textDim} />
          <Text style={s.mediaPlaceholderText}>Không tải được ảnh</Text>
        </View>
      )}
      <TextInput
        style={s.captionInput}
        value={block.content}
        onChangeText={t => onChangeText(block.id, t)}
        placeholder="Thêm chú thích..."
        placeholderTextColor={COLORS.textDim}
        multiline scrollEnabled={false}
      />
    </View>
  );
}

// ── Media: AudioBlock ─────────────────────────────────────────────────────────

function AudioBlock({ block, onDelete }: { block: Block; onDelete: () => void }) {
  return (
    <View style={[s.mediaCard, s.audioCard]}>
      <DeleteBtn onPress={onDelete} />
      <View style={s.audioRow}>
        <View style={s.audioPlayBtn}>
          <Ionicons name="play" size={18} color="#fff" />
        </View>
        <View style={s.waveformContainer}>
          {Array.from({ length: 22 }).map((_, i) => (
            <View key={i} style={[s.waveBar, { height: 4 + Math.abs(Math.sin(i * 0.85)) * 16 }]} />
          ))}
        </View>
        {block.duration !== undefined && (
          <Text style={s.audioDuration}>{fmtDuration(block.duration)}</Text>
        )}
      </View>
      <View style={s.mediaMetaRow}>
        <Ionicons name="mic-outline" size={12} color={COLORS.textDim} />
        <Text style={s.mediaMetaText} numberOfLines={1}>
          {block.fileName || 'Ghi âm'}
          {block.fileSize ? `  ·  ${fmtSize(block.fileSize)}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Media: VideoBlock ─────────────────────────────────────────────────────────

function VideoBlock({ block, onDelete }: { block: Block; onDelete: () => void }) {
  return (
    <View style={s.mediaCard}>
      <DeleteBtn onPress={onDelete} />
      <View style={s.videoThumb}>
        {block.uri && (
          <Image source={{ uri: block.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <View style={s.videoOverlay} />
        <View style={s.videoPlayBtn}>
          <Ionicons name="play" size={26} color="#fff" />
        </View>
        {block.duration !== undefined && (
          <View style={s.videoDurationBadge}>
            <Text style={s.videoDurationText}>{fmtDuration(block.duration)}</Text>
          </View>
        )}
      </View>
      <View style={s.mediaMetaRow}>
        <Ionicons name="videocam-outline" size={12} color={COLORS.textDim} />
        <Text style={s.mediaMetaText} numberOfLines={1}>
          {block.fileName || 'Video'}
          {block.fileSize ? `  ·  ${fmtSize(block.fileSize)}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Media: FileBlock ──────────────────────────────────────────────────────────

function FileBlock({ block, onDelete }: { block: Block; onDelete: () => void }) {
  const ext = block.fileName?.split('.').pop()?.toLowerCase() ?? '';

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    ext === 'pdf'                            ? 'document-text-outline'  :
    ['doc','docx'].includes(ext)             ? 'document-outline'       :
    ['xls','xlsx'].includes(ext)             ? 'grid-outline'           :
    ['ppt','pptx'].includes(ext)             ? 'easel-outline'          :
    ['zip','rar','7z'].includes(ext)         ? 'archive-outline'        :
    ['mp3','m4a','wav'].includes(ext)        ? 'musical-notes-outline'  :
                                               'attach-outline';

  const iconColor =
    ext === 'pdf'                            ? '#EF4444' :
    ['doc','docx'].includes(ext)             ? '#3B82F6' :
    ['xls','xlsx'].includes(ext)             ? '#10B981' :
    ['ppt','pptx'].includes(ext)             ? '#F59E0B' :
                                               COLORS.accent;

  return (
    <View style={[s.mediaCard, s.fileCard]}>
      <DeleteBtn onPress={onDelete} />
      <View style={s.fileRow}>
        <View style={[s.fileIconBox, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={iconName} size={26} color={iconColor} />
          {ext ? <Text style={[s.fileExt, { color: iconColor }]}>{ext.toUpperCase()}</Text> : null}
        </View>
        <View style={s.fileInfo}>
          <Text style={s.fileName} numberOfLines={2}>{block.fileName || 'Tài liệu'}</Text>
          {block.fileSize ? <Text style={s.fileSize}>{fmtSize(block.fileSize)}</Text> : null}
        </View>
      </View>
    </View>
  );
}

// ── BlockItem (main) ──────────────────────────────────────────────────────────

export default function BlockItem({
  block, numberedIndex, isFocused,
  onChangeText, onFocus, onEnterPress,
  onBackspace, onToggleCheck, onDelete,
}: BlockItemProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isFocused) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isFocused]);

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const { key } = e.nativeEvent;
    if (key === 'Backspace' && block.content === '') { onBackspace(block.id); return; }
    const isMultiline = block.type === 'text' || block.type === 'quote';
    if (key === 'Enter' && !isMultiline) onEnterPress(block.id);
  };

  // Media blocks
  if (block.type === 'image') return (
    <View style={s.mediaWrapper}>
      <ImageBlock block={block} onDelete={() => onDelete(block.id)} onChangeText={onChangeText} />
    </View>
  );

  if (block.type === 'audio') return (
    <View style={s.mediaWrapper}>
      <AudioBlock block={block} onDelete={() => onDelete(block.id)} />
    </View>
  );

  if (block.type === 'video') return (
    <View style={s.mediaWrapper}>
      <VideoBlock block={block} onDelete={() => onDelete(block.id)} />
    </View>
  );

  if (block.type === 'file') return (
    <View style={s.mediaWrapper}>
      <FileBlock block={block} onDelete={() => onDelete(block.id)} />
    </View>
  );

  // Divider
  if (block.type === 'divider') return (
    <View style={s.dividerRow}><View style={s.dividerLine} /></View>
  );

  // Text blocks
  const hasPrefix   = ['bullet','numbered','checkbox','quote'].includes(block.type);
  const isMultiline = block.type === 'text' || block.type === 'quote';

  return (
    <View style={s.row}>
      <BlockPrefix block={block} numberedIndex={numberedIndex} onToggle={() => onToggleCheck(block.id)} />
      <TextInput
        ref={inputRef}
        style={[s.input, getTextStyle(block.type), hasPrefix && s.inputWithPrefix, block.checked && s.textChecked]}
        value={block.content}
        onChangeText={t => onChangeText(block.id, t)}
        onFocus={() => onFocus(block.id)}
        onKeyPress={handleKeyPress}
        onSubmitEditing={() => { if (!isMultiline) onEnterPress(block.id); }}
        placeholder={isFocused ? getPlaceholder(block.type) : ''}
        placeholderTextColor={COLORS.textDim}
        multiline={isMultiline}
        scrollEnabled={false}
        blurOnSubmit={false}
        returnKeyType={isMultiline ? 'default' : 'next'}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row:             { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 2, minHeight: 36 },
  input:           { flex: 1, padding: 0, margin: 0 },
  inputWithPrefix: { marginLeft: 8 },

  bodyText:    { fontSize: 15, lineHeight: 24, color: COLORS.text, fontWeight: '400' },
  h1:          { fontSize: 24, fontWeight: '800', lineHeight: 32, color: COLORS.text },
  h2:          { fontSize: 20, fontWeight: '700', lineHeight: 28, color: COLORS.text },
  h3:          { fontSize: 17, fontWeight: '600', lineHeight: 24, color: COLORS.text },
  quote:       { fontSize: 15, lineHeight: 24, color: COLORS.textMuted, fontStyle: 'italic', fontWeight: '400' },
  textChecked: { textDecorationLine: 'line-through', color: COLORS.textDim },

  bullet:          { fontSize: 18, color: COLORS.accent, lineHeight: 24, width: 20, textAlign: 'center' },
  numberedPrefix:  { fontSize: 15, color: COLORS.accent, lineHeight: 24, minWidth: 24, textAlign: 'right', fontWeight: '500' },
  checkboxBtn:     { paddingTop: 3, marginRight: 2 },
  checkbox:        { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.textDim, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkmark:       { fontSize: 11, color: '#fff', fontWeight: '700', lineHeight: 14 },
  quoteLine:       { width: 3, borderRadius: 2, backgroundColor: COLORS.accent, alignSelf: 'stretch', marginRight: 10, minHeight: 24 },

  dividerRow:  { paddingHorizontal: 16, paddingVertical: 12 },
  dividerLine: { height: 1, backgroundColor: COLORS.border },

  // Media shared
  mediaWrapper:     { paddingHorizontal: 16, paddingVertical: 6 },
  mediaCard:        { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  mediaDeleteBtn:   { position: 'absolute', top: 8, right: 8, zIndex: 10 },
  mediaMetaRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8 },
  mediaMetaText:    { fontSize: 12, color: COLORS.textDim, flex: 1 },
  mediaPlaceholderText: { fontSize: 13, color: COLORS.textDim, marginTop: 6 },

  // Image
  imagePreview:     { width: '100%', height: 200 },
  imagePlaceholder: { backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  captionInput:     { paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },

  // Audio
  audioCard:        { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  audioRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audioPlayBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  waveformContainer:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 32 },
  waveBar:          { width: 3, borderRadius: 2, backgroundColor: COLORS.accent + '70' },
  audioDuration:    { fontSize: 12, color: COLORS.textMuted, minWidth: 32 },

  // Video
  videoThumb:         { width: '100%', height: 180, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  videoOverlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  videoPlayBtn:       { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  videoDurationBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  videoDurationText:  { fontSize: 11, color: '#fff', fontWeight: '600' },

  // File
  fileCard:    { padding: 14 },
  fileRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIconBox: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileExt:     { fontSize: 9, fontWeight: '700', marginTop: 1 },
  fileInfo:    { flex: 1 },
  fileName:    { fontSize: 14, color: COLORS.text, fontWeight: '500', lineHeight: 20 },
  fileSize:    { fontSize: 12, color: COLORS.textDim, marginTop: 2 },
});