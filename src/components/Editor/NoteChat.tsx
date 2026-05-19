import { Ionicons } from "@expo/vector-icons";
import React, { RefObject } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/colors";

export type NoteMsg = { role: "user" | "assistant"; content: string; _k: string };

const SUGGESTIONS = [
  "Tóm tắt ghi chú này",
  "Trích xuất thông tin liên lạc",
  "Liệt kê việc cần làm",
  "Có hẹn/sự kiện nào không?",
];

interface Props {
  visible: boolean;
  msgs: NoteMsg[];
  chatInput: string;
  chatLoading: boolean;
  chatRef: RefObject<FlatList | null>;
  onClose: () => void;
  onSend: () => void;
  onInputChange: (v: string) => void;
}

export function NoteChat({
  visible,
  msgs,
  chatInput,
  chatLoading,
  chatRef,
  onClose,
  onSend,
  onInputChange,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.sheet}
      >
        <View style={s.handle} />

        <View style={s.chatHead}>
          <View style={s.row}>
            <Ionicons name="sparkles" size={15} color={COLORS.accent} />
            <Text style={s.chatTitle}>Trợ lý AI</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={chatRef}
          data={msgs}
          keyExtractor={(m) => m._k}
          contentContainerStyle={s.chatList}
          ListEmptyComponent={
            <Text style={s.chatEmpty}>Hỏi tôi bất cứ điều gì về ghi chú này</Text>
          }
          renderItem={({ item: m }) => (
            <View style={[s.bubble, m.role === "user" ? s.bUser : s.bAI]}>
              <Text style={[s.bTx, m.role === "user" && s.bTxUser]}>{m.content}</Text>
            </View>
          )}
        />

        {msgs.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44, marginVertical: 6 }}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: "center" }}
          >
            {SUGGESTIONS.map((sg) => (
              <TouchableOpacity key={sg} style={s.suggest} onPress={() => onInputChange(sg)}>
                <Text style={s.suggestTx}>{sg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={s.chatInputRow}>
          <TextInput
            style={s.chatInput}
            value={chatInput}
            onChangeText={onInputChange}
            placeholder="Hỏi về ghi chú này..."
            placeholderTextColor={COLORS.textDim}
            onSubmitEditing={onSend}
            returnKeyType="send"
            editable={!chatLoading}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, chatLoading && { opacity: 0.5 }]}
            onPress={onSend}
            disabled={chatLoading}
          >
            {chatLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "78%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === "ios" ? 0 : 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  chatHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  chatTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginLeft: 6 },
  chatList: { padding: 12, gap: 8, flexGrow: 1 },
  chatEmpty: {
    textAlign: "center",
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 24,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bAI: {
    backgroundColor: COLORS.background,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  bUser: {
    backgroundColor: COLORS.accent,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bTx: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  bTxUser: { color: "#fff" },
  suggest: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  suggestTx: { fontSize: 12, color: COLORS.textMuted },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  chatInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
