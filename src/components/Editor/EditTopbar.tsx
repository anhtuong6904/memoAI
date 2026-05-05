import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { fmtDate } from "./helpers";

interface EditTopBarProps {
  isNew: boolean;
  saving: boolean;
  analyzing: boolean;
  showExtracted: boolean;
  hasExtracted: boolean;
  updatedAt?: string;
  savedOpacity: Animated.Value;
  unsavedDot: Animated.Value;
  onBack: () => void;
  onToggleExtracted: () => void;
  onAnalyze: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export default function EditTopBar({
  isNew,
  saving,
  analyzing,
  showExtracted,
  hasExtracted,
  updatedAt,
  savedOpacity,
  unsavedDot,
  onBack,
  onToggleExtracted,
  onAnalyze,
  onShare,
  onDelete,
}: EditTopBarProps) {
  return (
    <View style={s.topBar}>
      {/* Back + unsaved dot */}
      <TouchableOpacity
        style={s.backBtn}
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
        <Text style={s.backLabel}>Ghi chú</Text>
        <Animated.View style={[s.unsavedDot, { opacity: unsavedDot }]} />
      </TouchableOpacity>

      {/* Date / saving indicator */}
      <View style={s.topCenter} pointerEvents="none">
        {saving ? (
          <ActivityIndicator size="small" color={COLORS.textDim} />
        ) : (
          <>
            <Animated.Text style={[s.savedBadge, { opacity: savedOpacity }]}>
              ✓ Đã lưu
            </Animated.Text>
            <Text style={s.dateText}>
              {updatedAt ? fmtDate(updatedAt) : "Ghi chú mới"}
            </Text>
          </>
        )}
      </View>

      {/* Action buttons */}
      <View style={s.topRight}>
        {hasExtracted && (
          <TouchableOpacity style={s.topBtn} onPress={onToggleExtracted}>
            <Ionicons
              name="sparkles-outline"
              size={19}
              color={showExtracted ? COLORS.accent : COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
        {!isNew && (
          <TouchableOpacity
            style={s.topBtn}
            onPress={onAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons name="sparkles" size={19} color={COLORS.accent} />
            )}
          </TouchableOpacity>
        )}
        {!isNew && (
          <TouchableOpacity style={s.topBtn} onPress={onShare}>
            <Ionicons name="share-outline" size={19} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.topBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 2,
    minWidth: 80,
  },
  backLabel: { fontSize: 16, color: COLORS.accent },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
    marginLeft: 4,
  },
  topCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  dateText: { fontSize: 12, color: COLORS.textDim },
  savedBadge: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "600",
    position: "absolute",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 80,
    justifyContent: "flex-end",
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
});
