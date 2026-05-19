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
import { actions } from "react-native-pell-rich-editor";
import { COLORS } from "../../constants/colors";
import { fmtDur } from "../../utils/format";

const FORMAT_TEXT = [
  { label: "B", action: actions.setBold, style: { fontWeight: "700" as const } },
  { label: "I", action: actions.setItalic, style: { fontStyle: "italic" as const } },
  { label: "U", action: actions.setUnderline, style: { textDecorationLine: "underline" as const } },
  { label: "S", action: actions.setStrikethrough, style: { textDecorationLine: "line-through" as const } },
  { label: "H1", action: actions.heading1, style: {} },
  { label: "H2", action: actions.heading2, style: {} },
] as const;

const FORMAT_ICONS = [
  { icon: "list-outline", action: actions.insertBulletsList },
  { icon: "list-circle-outline", action: actions.insertOrderedList },
  { icon: "checkbox-outline", action: actions.checkboxList },
  { icon: "return-down-forward-outline", action: actions.blockquote },
  { icon: "code-slash-outline", action: actions.code },
  { icon: "arrow-undo-outline", action: actions.undo },
  { icon: "arrow-redo-outline", action: actions.redo },
] as const;

interface Props {
  richRef: React.RefObject<any>;
  activeStyles: string[];
  showLink: boolean;
  setShowLink: (v: boolean) => void;
  busy: boolean;
  recState: { isRecording: boolean; durationMillis?: number };
  recDur: number;
  onImg: () => void;
  onCam: () => void;
  onVid: () => void;
  onAud: () => void;
  onFile: () => void;
}

function MBtn({
  icon,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.mBtn, active && s.mBtnOn]}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
    >
      <Ionicons name={icon} size={18} color={active ? COLORS.accent : COLORS.textMuted} />
    </TouchableOpacity>
  );
}

export function EditorToolbar({
  richRef,
  activeStyles,
  showLink,
  setShowLink,
  busy,
  recState,
  recDur,
  onImg,
  onCam,
  onVid,
  onAud,
  onFile,
}: Props) {
  return (
    <View style={s.toolbarWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={s.toolbarRow}
      >
        {/* Media */}
        <MBtn icon="image-outline" onPress={onImg} />
        <MBtn icon="camera-outline" onPress={onCam} />
        <MBtn icon="videocam-outline" onPress={onVid} />
        <TouchableOpacity
          style={[s.mBtn, recState.isRecording && s.mBtnRec]}
          onPress={onAud}
          hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
        >
          <Ionicons
            name={recState.isRecording ? "stop-circle" : "mic-outline"}
            size={18}
            color={recState.isRecording ? COLORS.danger : COLORS.textMuted}
          />
          {recState.isRecording && <Text style={s.recTx}>{fmtDur(recDur)}</Text>}
        </TouchableOpacity>
        <MBtn icon="attach-outline" onPress={onFile} />
        <MBtn icon="link-outline" active={showLink} onPress={() => setShowLink(!showLink)} />
        {busy && (
          <ActivityIndicator size="small" color={COLORS.accent} style={{ marginHorizontal: 6 }} />
        )}

        <View style={s.toolbarSep} />

        {/* Format — text labels */}
        {FORMAT_TEXT.map(({ label, action, style }) => {
          const on = activeStyles.includes(action);
          return (
            <TouchableOpacity
              key={action}
              style={[s.mBtn, on && s.mBtnOn]}
              onPress={() => richRef.current?.sendAction(action)}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Text style={[s.fBtnTx, style, on && s.fBtnTxOn]}>{label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Format — icon buttons */}
        {FORMAT_ICONS.map(({ icon, action }) => {
          const on = activeStyles.includes(action);
          return (
            <TouchableOpacity
              key={action}
              style={[s.mBtn, on && s.mBtnOn]}
              onPress={() => richRef.current?.sendAction(action)}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Ionicons
                name={icon}
                size={18}
                color={on ? COLORS.accent : COLORS.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  toolbarWrap: {
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingVertical: 3,
  },
  toolbarRow: {
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 1,
    minHeight: 44,
  },
  toolbarSep: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 6,
    borderRadius: 1,
  },
  mBtn: {
    minWidth: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginHorizontal: 1,
  },
  mBtnOn: { backgroundColor: COLORS.active },
  mBtnRec: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    backgroundColor: `${COLORS.danger}18`,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.danger}40`,
  },
  recTx: { fontSize: 11, color: COLORS.danger, fontWeight: "700" },
  fBtnTx: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "600",
    minWidth: 22,
    textAlign: "center",
  },
  fBtnTxOn: { color: COLORS.accent },
});
