import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { COLORS } from "../../constants/colors";

interface EditTagRowProps {
  tags: string[];
  tagInput: string;
  showTagInput: boolean;
  setTagInput: (v: string) => void;
  setShowTagInput: (v: boolean) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}

export default function EditTagRow({
  tags,
  tagInput,
  showTagInput,
  setTagInput,
  setShowTagInput,
  onAddTag,
  onRemoveTag,
}: EditTagRowProps) {
  return (
    <>
      <View style={s.tagsRow}>
        {tags.map((t) => (
          <TouchableOpacity
            key={t}
            style={s.tagChip}
            onPress={() => onRemoveTag(t)}
          >
            <Text style={s.tagChipText}>#{t}</Text>
            <Text style={s.tagChipX}> ✕</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={s.tagAddBtn}
          onPress={() => setShowTagInput(!showTagInput)}
        >
          <Ionicons name="pricetag-outline" size={11} color={COLORS.textDim} />
          <Text style={s.tagAddText}>tag</Text>
        </TouchableOpacity>
      </View>

      {showTagInput && (
        <View style={s.tagInputRow}>
          <TextInput
            style={s.tagField}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="#tên-tag"
            placeholderTextColor={COLORS.textDim}
            onSubmitEditing={onAddTag}
            returnKeyType="done"
            autoCapitalize="none"
            autoFocus
          />
          <TouchableOpacity style={s.tagConfirmBtn} onPress={onAddTag}>
            <Text style={s.tagConfirmText}>Thêm</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 28,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.active,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: { fontSize: 12, color: COLORS.accent, fontWeight: "600" },
  tagChipX: { fontSize: 10, color: COLORS.accent, opacity: 0.6 },
  tagAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  tagAddText: { fontSize: 12, color: COLORS.textDim },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tagField: {
    flex: 1,
    height: 36,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.text,
  },
  tagConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
  },
  tagConfirmText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
