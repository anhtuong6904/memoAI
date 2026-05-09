/**
 * src/components/editor/FileChip.tsx
 * Chip hiển thị 1 file đính kèm — icon theo loại file, tên, size, nút xóa
 */

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../constants/colors";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileAttachment {
  /** id local (trước khi upload) hoặc id từ server */
  id: string;
  name: string;
  uri: string; // local file:// hoặc http:// sau upload
  mimeType?: string;
  size?: number; // bytes
  uploaded: boolean;
  remoteUrl?: string; // URL sau khi upload thành công
}

interface FileChipProps {
  file: FileAttachment;
  onRemove: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Icon theo MIME type hoặc extension */
function getFileIcon(file: FileAttachment): {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
} {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.mimeType ?? "";

  if (["pdf"].includes(ext) || mime.includes("pdf"))
    return { name: "document-text", color: "#EF4444" };

  if (["doc", "docx"].includes(ext) || mime.includes("word"))
    return { name: "document", color: "#3B82F6" };

  if (
    ["xls", "xlsx"].includes(ext) ||
    mime.includes("excel") ||
    mime.includes("spreadsheet")
  )
    return { name: "grid", color: "#10B981" };

  if (["ppt", "pptx"].includes(ext) || mime.includes("presentation"))
    return { name: "easel", color: "#F59E0B" };

  if (["txt", "md"].includes(ext) || mime.includes("text/plain"))
    return { name: "reader", color: "#9CA3AF" };

  if (["xml", "json", "yaml", "yml", "csv"].includes(ext))
    return { name: "code-slash", color: "#6C63FF" };

  if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return { name: "archive", color: "#F59E0B" };

  if (["mp4", "mov", "avi", "mkv"].includes(ext) || mime.includes("video"))
    return { name: "videocam", color: "#EC4899" };

  return { name: "attach", color: COLORS.textMuted };
}

/** Format bytes → KB / MB */
function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FileChip({ file, onRemove }: FileChipProps) {
  const icon = getFileIcon(file);

  const handleOpen = async () => {
    const url = file.remoteUrl ?? file.uri;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Không thể mở",
        "Thiết bị không có app hỗ trợ loại file này.",
      );
    }
  };

  return (
    <TouchableOpacity style={s.chip} onPress={handleOpen} activeOpacity={0.75}>
      {/* Icon loại file */}
      <View style={[s.iconBox, { backgroundColor: icon.color + "18" }]}>
        <Ionicons name={icon.name} size={18} color={icon.color} />
      </View>

      {/* Tên + size */}
      <View style={s.meta}>
        <Text style={s.name} numberOfLines={1} ellipsizeMode="middle">
          {file.name}
        </Text>
        <View style={s.bottomRow}>
          {file.size ? <Text style={s.size}>{fmtSize(file.size)}</Text> : null}
          {!file.uploaded && (
            <View style={s.pendingBadge}>
              <Text style={s.pendingText}>chưa lưu</Text>
            </View>
          )}
        </View>
      </View>

      {/* Nút xóa */}
      <TouchableOpacity
        onPress={() => onRemove(file.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={s.removeBtn}
      >
        <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    width: 200, // fixed width để scroll ngang đẹp
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  size: {
    fontSize: 11,
    color: COLORS.textDim,
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + "25",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pendingText: {
    fontSize: 10,
    color: COLORS.warning,
    fontWeight: "600",
  },
  removeBtn: {
    flexShrink: 0,
  },
});
