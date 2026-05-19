import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../constants/colors";

interface Props {
  tags: string[];
  showTag: boolean;
  tagInput: string;
  onRemove: (tag: string) => void;
  onToggle: () => void;
  onChangeInput: (v: string) => void;
  onAdd: () => void;
}

export function TagEditor({
  tags,
  showTag,
  tagInput,
  onRemove,
  onToggle,
  onChangeInput,
  onAdd,
}: Props) {
  return (
    <>
      <View style={s.tags}>
        {tags.map((t) => (
          <TouchableOpacity key={t} style={s.chip} onPress={() => onRemove(t)}>
            <Text style={s.chipTx}>#{t}</Text>
            <Ionicons name="close" size={11} color={COLORS.accent} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.addChip} onPress={onToggle}>
          <Ionicons name="pricetag-outline" size={11} color={COLORS.textDim} />
          <Text style={s.addChipTx}>tag</Text>
        </TouchableOpacity>
      </View>

      {showTag && (
        <View style={s.inline}>
          <TextInput
            style={s.inField}
            value={tagInput}
            onChangeText={onChangeInput}
            placeholder="#tên-tag"
            placeholderTextColor={COLORS.textDim}
            onSubmitEditing={onAdd}
            returnKeyType="done"
            autoCapitalize="none"
            autoFocus
          />
          <TouchableOpacity style={s.inBtn} onPress={onAdd}>
            <Text style={s.inBtnTx}>Thêm</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.active,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipTx: { fontSize: 12, color: COLORS.accent, fontWeight: "600" },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  addChipTx: { fontSize: 12, color: COLORS.textDim },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 4,
    gap: 8,
  },
  inField: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    fontSize: 13,
    color: COLORS.text,
  },
  inBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
  },
  inBtnTx: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
