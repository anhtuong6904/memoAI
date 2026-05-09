import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";
import { chatWithAI } from "../services/api";
import { ChatMessage } from "../types";

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <View style={[s.row, isUser && s.rowUser]}>
      {!isUser && (
        <View style={s.avatar}>
          <Text style={s.avatarTx}>AI</Text>
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bUser : s.bAI]}>
        <Text style={[s.bText, isUser && s.bTextUser]}>{msg.content}</Text>
      </View>
    </View>
  );
}

const SUGGESTIONS = [
  "Tom tat ghi chu tuan nay",
  "Toi co cuoc hop nao sap toi?",
  "Liet ke viec can lam",
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { answer } = await chatWithAI(text, messages);
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Loi ket noi. Kiem tra backend." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <View style={s.header}>
        <View style={s.headerIcon}>
          <Ionicons name="sparkles" size={18} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Chat AI</Text>
          <Text style={s.headerSub}>Hoi ve ghi chu cua ban</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity style={s.clearBtn} onPress={() => setMessages([])}>
            <Ionicons name="trash-outline" size={18} color={COLORS.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {messages.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
            <Text style={s.emptyTitle}>Second Brain</Text>
            <Text style={s.emptySub}>
              Hoi bat cu dieu gi ve ghi chu cua ban
            </Text>
            <View style={{ width: "100%", gap: 8, marginTop: 16 }}>
              {SUGGESTIONS.map((sg) => (
                <TouchableOpacity
                  key={sg}
                  style={s.suggestion}
                  onPress={() => setInput(sg)}
                >
                  <Text style={s.suggestionTx}>{sg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => <Bubble msg={item} />}
          />
        )}

        {loading && (
          <View style={s.thinking}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={s.thinkingTx}>Dang suy nghi...</Text>
          </View>
        )}

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Hoi ve ghi chu cua ban..."
            placeholderTextColor={COLORS.textDim}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendDim]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.active,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center" },
  suggestion: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionTx: { fontSize: 13, color: COLORS.textMuted },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.active,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTx: { fontSize: 10, fontWeight: "700", color: COLORS.accent },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bAI: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
  bUser: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bText: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  bTextUser: { color: "#fff" },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  thinkingTx: { fontSize: 13, color: COLORS.textMuted },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDim: { opacity: 0.4 },
});
