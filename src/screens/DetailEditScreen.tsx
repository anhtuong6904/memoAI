import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RichEditor } from "react-native-pell-rich-editor";
import { SafeAreaView } from "react-native-safe-area-context";

import { AudioPlayerBar } from "../components/Editor/AudioPlayerBar";
import { EditorToolbar } from "../components/Editor/EditorToolbar";
import { EditorTopBar } from "../components/Editor/EditorTopBar";
import { NoteChat, NoteMsg } from "../components/Editor/NoteChat";
import { TagEditor } from "../components/Editor/TagEditor";
import { COLORS } from "../constants/colors";
import { EDITOR_CSS } from "../constants/editorStyles";
import { useAutoSave } from "../hooks/useAutoSave";
import { useEditorHeight } from "../hooks/useEditorHeight";
import { useMediaHandlers } from "../hooks/useMediaHandlers";
import { useNoteEditor } from "../hooks/useNoteEditor";
import { useNoteDetail } from "../hooks/useNotes";
import { chatWithNote, deleteNote } from "../services/api";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Edit">;

let _seq = 0;
const mk = (m: Omit<NoteMsg, "_k">): NoteMsg => ({ ...m, _k: `m${++_seq}` });

const parseTags = (s: string): string[] => {
  try { return JSON.parse(s); } catch { return []; }
};

export default function EditScreen({ route, navigation }: Props) {
  const noteId = route.params?.noteId;
  const isNew = noteId === undefined;
  const { note, loading: noteLoading } = useNoteDetail(noteId, route.params?.initialNote);

  // Shared refs passed into multiple hooks
  const richRef = useRef<any>(null);
  const titleRef = useRef<TextInput>(null);
  const chatRef = useRef<FlatList>(null);
  const noteIdRef = useRef<number | null>(noteId ?? null);
  const chatNoteId = useRef<number | null>(null);
  const dirty = useRef(false);
  const htmlRef = useRef("");

  // UI state
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTag, setShowTag] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [msgs, setMsgs] = useState<NoteMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<{ uri: string; name: string } | null>(null);

  // Audio player (hook must live at screen level)
  const audioPlayer = useAudioPlayer(playingAudio ? { uri: playingAudio.uri } : null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  // Custom hooks
  const { setScrollViewH, setTopAreaH, setContentH, editorHeight, pollHeight } =
    useEditorHeight(richRef);

  const { editorReady, pendingHtml, setEditorHTML, onEditorChange, onEditorInit, onEditorMessage } =
    useNoteEditor({ richRef, pollHeight, setContentH, setPlayingAudio, htmlRef, dirty });

  const { saving, analyzing, fadeAnim, ensureId, doSave, saveRef } = useAutoSave({
    htmlRef, dirty, title, tags, noteIdRef, navigation,
  });

  const { busy, recState, recDur, handleImg, handleCam, handleVid, handleAud, handleFile } =
    useMediaHandlers({ richRef, ensureId, dirty, pollHeight });

  // Populate editor when note loads
  useEffect(() => {
    if (!note) return;
    noteIdRef.current = note.id;
    if (!dirty.current) {
      setTitle(note.title ?? "");
      setTags(parseTags(note.tags));
    }
    let html = "";
    const raw = (note as any).content_json;
    if (raw && typeof raw === "string" && raw.trim().startsWith("<")) {
      html = raw;
    } else if (note.content) {
      html = `<p>${note.content.replace(/\n/g, "</p><p>")}</p>`;
    }
    if (!dirty.current) {
      if (editorReady.current) setEditorHTML(html);
      else pendingHtml.current = html;
    }
  }, [note, setEditorHTML]);

  // Cleanup audio on unmount
  useEffect(() => () => { audioPlayer.pause(); }, [audioPlayer]);

  // Focus title for new notes
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => titleRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [isNew]);

  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  // Auto-save on back navigation
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (!dirty.current) return;
      e.preventDefault();
      saveRef.current(false)
        .catch((err) => console.warn("[Edit] save-on-leave:", err))
        .finally(() => { if (navigation.canGoBack()) navigation.dispatch(e.data.action); });
    });
    return unsub;
  }, [navigation]);

  const handleDelete = () => {
    const id = noteIdRef.current;
    if (!id) { navigation.goBack(); return; }
    Alert.alert("Xoá ghi chú", "Không thể khôi phục sau khi xoá.", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNote(id);
            dirty.current = false;
            navigation.goBack();
          } catch {
            Alert.alert("Lỗi", "Không xoá được.");
          }
        },
      },
    ]);
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!url) { setShowLink(false); return; }
    richRef.current?.insertLink(url, url.startsWith("http") ? url : `https://${url}`);
    dirty.current = true;
    setLinkUrl("");
    setShowLink(false);
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) { setTags((p) => [...p, t]); dirty.current = true; }
    setTagInput("");
    setShowTag(false);
  };

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const id = noteIdRef.current;
    if (!id) { Alert.alert("Hãy lưu ghi chú trước."); return; }
    const userMsg = mk({ role: "user", content: text });
    const thread = [...msgs, userMsg];
    setMsgs(thread);
    setChatInput("");
    setChatLoading(true);
    try {
      const { answer } = await chatWithNote(id, text, msgs);
      setMsgs([...thread, mk({ role: "assistant", content: answer })]);
    } catch (e) {
      console.warn("[Edit] chat:", e);
      setMsgs([...thread, mk({ role: "assistant", content: "Lỗi kết nối. Kiểm tra backend." })]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatInput, chatLoading, msgs]);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <EditorTopBar
        saving={saving}
        analyzing={analyzing}
        note={note}
        fadeAnim={fadeAnim}
        showChatBtn={noteIdRef.current !== null}
        onBack={() => navigation.canGoBack() && navigation.goBack()}
        onSave={() => doSave(true)}
        onDelete={handleDelete}
        onOpenChat={() => {
          const nid = noteIdRef.current;
          if (nid !== chatNoteId.current) {
            setMsgs([]);
            setChatInput("");
            chatNoteId.current = nid;
          }
          setShowChat(true);
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          onLayout={(e) => setScrollViewH(e.nativeEvent.layout.height)}
        >
          <View onLayout={(e) => setTopAreaH(e.nativeEvent.layout.height)}>
            <TextInput
              ref={titleRef}
              style={s.titleInput}
              value={title}
              onChangeText={(t) => { setTitle(t); dirty.current = true; }}
              placeholder="Tiêu đề"
              placeholderTextColor={COLORS.textDim}
              multiline
              returnKeyType="next"
            />
            <TagEditor
              tags={tags}
              showTag={showTag}
              tagInput={tagInput}
              onRemove={(t) => { setTags((p) => p.filter((x) => x !== t)); dirty.current = true; }}
              onToggle={() => setShowTag((v) => !v)}
              onChangeInput={setTagInput}
              onAdd={addTag}
            />
          </View>

          <View style={s.divider} />

          <RichEditor
            ref={richRef}
            useContainer={false}
            style={[s.editor, { height: editorHeight }]}
            editorStyle={{
              backgroundColor: COLORS.background,
              color: COLORS.text,
              placeholderColor: COLORS.textDim,
              cssText: EDITOR_CSS,
            }}
            placeholder="Bắt đầu ghi chú..."
            onChange={onEditorChange}
            editorInitializedCallback={onEditorInit}
            onMessage={onEditorMessage}
            onHeightChange={(h) => setContentH((prev) => Math.max(prev, h))}
            // @ts-ignore — prop exists at runtime but missing from type declarations
            onActiveStylesChange={setActiveStyles}
          />
        </ScrollView>

        {showLink && (
          <View style={s.inline}>
            <TextInput
              style={s.inField}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://..."
              placeholderTextColor={COLORS.textDim}
              onSubmitEditing={insertLink}
              returnKeyType="done"
              autoCapitalize="none"
              keyboardType="url"
              autoFocus
            />
            <TouchableOpacity style={s.inBtn} onPress={insertLink}>
              <Text style={s.inBtnTx}>Chèn</Text>
            </TouchableOpacity>
          </View>
        )}

        <EditorToolbar
          richRef={richRef}
          activeStyles={activeStyles}
          showLink={showLink}
          setShowLink={setShowLink}
          busy={busy}
          recState={recState}
          recDur={recDur}
          onImg={handleImg}
          onCam={handleCam}
          onVid={handleVid}
          onAud={handleAud}
          onFile={handleFile}
        />
      </KeyboardAvoidingView>

      <NoteChat
        visible={showChat}
        msgs={msgs}
        chatInput={chatInput}
        chatLoading={chatLoading}
        chatRef={chatRef}
        onClose={() => { setShowChat(false); setMsgs([]); setChatInput(""); chatNoteId.current = null; }}
        onSend={sendChat}
        onInputChange={setChatInput}
      />

      {playingAudio && (
        <AudioPlayerBar
          name={playingAudio.name}
          currentTime={audioStatus.currentTime ?? 0}
          duration={audioStatus.duration ?? null}
          playing={audioStatus.playing}
          onPlayPause={() => audioStatus.playing ? audioPlayer.pause() : audioPlayer.play()}
          onClose={() => { audioPlayer.pause(); setPlayingAudio(null); }}
        />
      )}

      {noteLoading && !isNew && !note && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  titleInput: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 34,
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  editor: { backgroundColor: COLORS.background },
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
