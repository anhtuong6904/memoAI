/**
 * src/components/editor/FileAttachmentBar.tsx
 *
 * Dùng fetch + FormData thay vì FileSystem.uploadAsync
 * để tránh lỗi FileSystemUploadType với expo-file-system 18+
 */
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/colors";
import { deleteAttachment, uploadAttachment } from "../../services/api";
import { FileAttachment } from "../../types";
import FileChip from "./FileChip";

interface Props {
  noteId:      number | undefined;
  attachments: FileAttachment[];
  onChange:    (files: FileAttachment[]) => void;
}

export default function FileAttachmentBar({ noteId, attachments, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type:                 "*/*",
        copyToCacheDirectory: true,
        multiple:             true,
      });
      if (res.canceled) return;

      const newFiles: FileAttachment[] = res.assets.map((a) => ({
        id:       `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name:     a.name,
        uri:      a.uri,
        mimeType: a.mimeType ?? undefined,
        size:     a.size ?? undefined,
        uploaded: false,
      }));

      const updated = [...attachments, ...newFiles];
      onChange(updated);

      if (noteId) {
        setUploading(true);
        const final = [...updated];
        for (const file of newFiles) {
          try {
            /**
             * uploadAttachment trong api.ts dùng fetch + FormData —
             * không dùng FileSystem.uploadAsync nên tránh được lỗi
             * FileSystemUploadType không tồn tại trong expo-file-system 18.
             */
            const uploaded = await uploadAttachment(
              noteId,
              file.uri,
              file.name,
              file.mimeType
            );
            const idx = final.findIndex((f) => f.id === file.id);
            if (idx !== -1) final[idx] = uploaded;
          } catch (e) {
            console.warn("Upload failed:", file.name, e);
          }
        }
        onChange(final);
        setUploading(false);
      }
    } catch {
      Alert.alert("Loi", "Khong the chon file. Thu lai.");
    }
  };

  const remove = async (id: string) => {
    const file = attachments.find((f) => f.id === id);
    if (!file) return;
    if (file.uploaded && noteId && !id.startsWith("local_")) {
      try { await deleteAttachment(noteId, id); } catch {}
    }
    onChange(attachments.filter((f) => f.id !== id));
  };

  if (attachments.length === 0 && !uploading) {
    return (
      <TouchableOpacity style={s.emptyBtn} onPress={pick} activeOpacity={0.7}>
        <Ionicons name="attach" size={16} color={COLORS.textDim} />
        <Text style={s.emptyLabel}>Dinh kem tep</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipList}
        keyboardShouldPersistTaps="always"
      >
        {attachments.map((f) => (
          <FileChip key={f.id} file={f} onRemove={remove} />
        ))}

        <TouchableOpacity style={s.addMore} onPress={pick} activeOpacity={0.7}>
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <>
              <Ionicons name="add" size={20} color={COLORS.accent} />
              <Text style={s.addMoreLabel}>Them</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
  },
  chipList: {
    paddingHorizontal: 16,
    gap:               8,
    alignItems:        "center",
  },
  emptyBtn: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              6,
    paddingHorizontal: 16,
    paddingVertical:  10,
    borderTopWidth:   StyleSheet.hairlineWidth,
    borderTopColor:   COLORS.border,
  },
  emptyLabel: {
    fontSize: 13,
    color:    COLORS.textDim,
  },
  addMore: {
    width:           56,
    height:          50,
    borderRadius:    10,
    backgroundColor: COLORS.surface,
    borderWidth:     1,
    borderStyle:     "dashed",
    borderColor:     COLORS.accent + "60",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             2,
  },
  addMoreLabel: {
    fontSize:   10,
    color:      COLORS.accent,
    fontWeight: "600",
  },
});