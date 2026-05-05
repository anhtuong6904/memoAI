import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { BlockType } from "../../types";
import { TOOLBAR_ITEMS } from "./helpers";

interface EditToolbarProps {
  focusedBlockType?: BlockType | "divider";
  saving: boolean;
  onFormat: (type: BlockType | "divider") => void;
  onAttach: () => void;
  onSave: () => void;
}

export default function EditToolbar({
  focusedBlockType,
  saving,
  onFormat,
  onAttach,
  onSave,
}: EditToolbarProps) {
  return (
    <View style={s.toolbar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.toolbarItems}
        keyboardShouldPersistTaps="always"
      >
        {TOOLBAR_ITEMS.map((item) => {
          const active = focusedBlockType === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.toolBtn, active && s.toolBtnActive]}
              onPress={() => onFormat(item.id as BlockType | "divider")}
              activeOpacity={0.7}
            >
              <Text style={[s.toolBtnText, active && s.toolBtnTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.toolSep} />

      <View style={s.toolRight}>
        <TouchableOpacity style={s.toolIconBtn} onPress={onAttach}>
          <Ionicons name="attach" size={21} color={COLORS.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, saving && s.doneBtnDim]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.doneBtnText}>Lưu</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  toolbarItems: { alignItems: "center", gap: 4 },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  toolBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  toolBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  toolBtnTextActive: { color: "#fff" },
  toolSep: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: COLORS.border,
  },
  toolRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  toolIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  doneBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  doneBtnDim: { opacity: 0.5 },
  doneBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
