import {
  CoreBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
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
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FileAttachmentBar from "../components/Editor/FileAttachmentBar";
import { COLORS } from "../constants/colors";
import { useNoteDetail } from "../hooks/useNotes";
import {
  analyzeNote,
  createNote,
  deleteNote,
  updateNote,
  uploadAttachment,
} from "../services/api";
import { FileAttachment, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Edit">;

interface AudioState {
  uri: string;
  duration: number;
  uploaded: boolean;
  remoteUrl?: string;
}

// ── Dark theme CSS injected vào WebView của TenTap ─────────────────────
const EDITOR_CSS = `
  body {
    background-color: ${COLORS.background};
    color: ${COLORS.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 16px; line-height: 1.6;
    padding: 12px 16px; margin: 0;
    caret-color: ${COLORS.accent};
  }
  ::selection { background-color: ${COLORS.accent}55; }
  h1 { font-size: 26px; font-weight: 800; margin: 18px 0 8px; line-height: 1.3; color: ${COLORS.text}; }
  h2 { font-size: 22px; font-weight: 700; margin: 16px 0 6px; line-height: 1.3; color: ${COLORS.text}; }
  h3 { font-size: 18px; font-weight: 600; margin: 12px 0 4px; line-height: 1.4; color: ${COLORS.text}; }
  p { margin: 6px 0; color: ${COLORS.text}; }
  ul, ol { padding-left: 24px; margin: 6px 0; }
  li { margin: 3px 0; color: ${COLORS.text}; }
  ul[data-type="taskList"] { list-style: none; padding: 0; }
  ul[data-type="taskList"] li {
    display: flex; align-items: flex-start; gap: 8px; margin: 6px 0;
  }
  ul[data-type="taskList"] input[type="checkbox"] {
    accent-color: ${COLORS.accent}; width: 18px; height: 18px; margin-top: 2px;
  }
  blockquote {
    border-left: 3px solid ${COLORS.accent};
    padding-left: 14px; margin: 10px 0;
    color: ${COLORS.textMuted}; font-style: italic;
    background: ${COLORS.surface}40; border-radius: 0 8px 8px 0;
  }
  code {
    background: ${COLORS.surface}; color: ${COLORS.accent};
    padding: 2px 6px; border-radius: 4px;
    font-family: "SF Mono", Consolas, monospace; font-size: 14px;
  }
  pre {
    background: ${COLORS.surface}; border-radius: 10px; padding: 14px;
    overflow-x: auto; margin: 10px 0; border: 1px solid ${COLORS.border};
  }
  pre code { background: transparent; padding: 0; color: ${COLORS.text}; font-size: 13px; }
  hr { border: none; height: 1px; background: ${COLORS.border}; margin: 18px 0; }
  a { color: ${COLORS.accent}; text-decoration: underline; }
  img { max-width: 100%; height: auto; border-radius: 10px; margin: 10px 0; display: block; }
  strong { color: ${COLORS.text}; font-weight: 700; }
  em { color: ${COLORS.text}; font-style: italic; }
  p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: ${COLORS.textDim};
    pointer-events: none; height: 0; float: left;
  }
`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDur = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const parseTags = (raw: string): string[] => {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

async function uriToBase64(
  uri: string,
  mimeType = "image/jpeg",
): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  return `data:${mimeType};base64,${b64}`;
}

function serializeContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

export default function EditScreen({ route, navigation }: Props) {
  const noteId = route.params?.noteId;
  const isNew = noteId === undefined;

  const {
    note,
    extracted,
    attachment,
    loading: noteLoading,
    reload,
  } = useNoteDetail(noteId);

  const sessionNoteIdRef = useRef<number | null>(noteId ?? null);
  const initialLoadDone = useRef(false);

  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [fileAttach, setFileAttach] = useState<FileAttachment[]>([]);
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const titleRef = useRef<TextInput>(null);
  const isDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedOpacity = useRef(new Animated.Value(0)).current;

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: "",
    bridgeExtensions: [...TenTapStartKit, CoreBridge.configureCSS(EDITOR_CSS)],
    onChange: () => markDirty(),
  });
  const editorContent = useEditorContent(editor, { type: "json" });

  // Sync note → editor CHỈ 1 LẦN
  useEffect(() => {
    if (!note) return;
    sessionNoteIdRef.current = note.id;
    if (initialLoadDone.current) return;
    setTitle(note.title ?? "");
    setTags(parseTags(note.tags));
    setFileAttach(attachment ?? []);
    const timer = setTimeout(() => {
      const json = (note as any).content_json;
      if (json) {
        try {
          const parsed = typeof json === "string" ? JSON.parse(json) : json;
          editor.setContent(parsed);
        } catch {}
      } else if (note.content) {
        editor.setContent(`<p>${note.content.replace(/\n/g, "</p><p>")}</p>`);
      }
      initialLoadDone.current = true;
    }, 150);

    return () => clearTimeout(timer);
  }, [note]);

  useFocusEffect(
    useCallback(() => {
      initialLoadDone.current = false; // ← thêm dòng này
      reload();
    }, [reload]),
  );

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => titleRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // beforeRemove listener — wrap dispatch trong try/catch
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!isDirty.current) return;
      e.preventDefault();
      doSave(false)
        .catch((err) => console.warn("save before leave err:", err))
        .finally(() => {
          try {
            navigation.dispatch(e.data.action);
          } catch (err) {
            console.warn("dispatch err:", err);
          }
        });
    });
    return unsub;
  }, [navigation, title, tags, editorContent]);

  useEffect(
    () => () => {
      sound?.unloadAsync();
    },
    [sound],
  );

  const flashSaved = () =>
    Animated.sequence([
      Animated.timing(savedOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.timing(savedOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

  const markDirty = useCallback(() => {
    isDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(false), 1500);
  }, []);

  // ── Tự tạo note nếu chưa có id, trả về id ──────────────────────────
  const ensureNoteId = useCallback(async (): Promise<number> => {
    if (sessionNoteIdRef.current !== null) return sessionNoteIdRef.current;
    const newNote = await createNote("", title || "Ghi chu moi");
    sessionNoteIdRef.current = newNote.id;
    navigation.setParams({ noteId: newNote.id });
    initialLoadDone.current = true;
    console.log("ensureNoteId: created", newNote.id);
    return newNote.id;
  }, [title, navigation]);

  const doSave = useCallback(
    async (spinner: boolean) => {
      const cj = serializeContent(editorContent);
      if (!title.trim() && !cj.trim()) return;
      try {
        if (spinner) setSaving(true);
        const id = await ensureNoteId();
        await updateNote(id, {
          title: title || "",
          content_json: cj,
          tags: JSON.stringify(tags),
        });
        isDirty.current = false;
        flashSaved();
      } catch (e) {
        console.error("doSave error:", e);
        if (spinner)
          Alert.alert(
            "Loi luu",
            e instanceof Error ? e.message : "Luu that bai",
          );
      } finally {
        if (spinner) setSaving(false);
      }
    },
    [editorContent, ensureNoteId, tags, title],
  );

  const handleDelete = () => {
    const id = sessionNoteIdRef.current;
    if (id === null) {
      navigation.goBack();
      return;
    }
    Alert.alert("Xoa ghi chu", "Khong the khoi phuc?", [
      { text: "Huy", style: "cancel" },
      {
        text: "Xoa",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNote(id);
            isDirty.current = false;
            // Chỉ goBack khi delete thành công
            if (navigation.canGoBack()) navigation.goBack();
          } catch (e) {
            console.error("delete err:", e);
            Alert.alert(
              "Loi xoa",
              "Khong xoa duoc note. Co the do FK trong DB cu. " +
                "Hay restart backend de chay migration.",
            );
          }
        },
      },
    ]);
  };

  const handleAnalyze = async () => {
    const id = sessionNoteIdRef.current;
    if (id === null) {
      Alert.alert("Luu truoc", "Hay luu ghi chu truoc khi phan tich.");
      return;
    }
    setAnalyzing(true);
    try {
      await doSave(false);
      const result = await analyzeNote(id);
      console.log("analyze result:", result);
      await reload();
      setShowExtracted(true);
    } catch (e) {
      console.error("analyze error:", e);
      Alert.alert(
        "Loi phan tich",
        e instanceof Error ? e.message : "Khong xac dinh",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Image: luôn upload as attachment (auto-create note nếu cần) ──────
  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Can quyen anh");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "livePhotos", "videos"],
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const dataUri = await uriToBase64(asset.uri, "image/jpeg");
      editor.setImage(dataUri);
      markDirty();
      const id = await ensureNoteId();
      const att = await uploadAttachment(
        id,
        asset.uri,
        `photo_${Date.now()}.jpg`,
        "image/jpeg",
      );
      setFileAttach((prev) => [...prev, att]);
      console.log("image uploaded:", att.id);
    } catch (e) {
      console.error("pick image:", e);
      Alert.alert(
        "Loi",
        "Khong the them anh: " + (e instanceof Error ? e.message : ""),
      );
    }
  };

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Can quyen camera");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const dataUri = await uriToBase64(asset.uri, "image/jpeg");
      editor.setImage(dataUri);
      markDirty();
      const id = await ensureNoteId();
      const att = await uploadAttachment(
        id,
        asset.uri,
        `cam_${Date.now()}.jpg`,
        "image/jpeg",
      );
      setFileAttach((prev) => [...prev, att]);
      console.log("camera uploaded:", att.id);
    } catch (e) {
      console.error("camera:", e);
      Alert.alert("Loi", "Khong the them anh tu camera.");
    }
  };

  // ── Audio: upload sau khi recording dừng ──────────────────────────
  const startRec = async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Can quyen micro");
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    setRecording(rec);
    setIsRecording(true);
    setRecSec(0);
    recTimer.current = setInterval(() => setRecSec((s) => s + 1), 1000);
  };

  const stopRec = async () => {
    if (!recording) return;
    if (recTimer.current) clearInterval(recTimer.current);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const dur = recSec;
    setRecording(null);
    setIsRecording(false);
    if (!uri) return;

    setAudioState({ uri, duration: dur, uploaded: false });
    markDirty();

    // Upload audio như attachment ngay
    setUploadingAudio(true);
    try {
      const id = await ensureNoteId();
      const ext = uri.split(".").pop() ?? "m4a";
      const att = await uploadAttachment(
        id,
        uri,
        `voice_${Date.now()}.${ext}`,
        ext === "m4a" ? "audio/x-m4a" : "audio/mp4",
      );
      setFileAttach((prev) => [...prev, att]);
      setAudioState((prev) =>
        prev ? { ...prev, uploaded: true, remoteUrl: att.remoteUrl } : prev,
      );
      console.log("audio uploaded:", att.id);
    } catch (e) {
      console.error("audio upload:", e);
      Alert.alert(
        "Loi",
        "Khong the upload audio: " + (e instanceof Error ? e.message : ""),
      );
    } finally {
      setUploadingAudio(false);
    }
  };

  const togglePlay = async () => {
    if (!audioState) return;
    if (isPlaying && sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
      return;
    }
    const { sound: snd } = await Audio.Sound.createAsync(
      { uri: audioState.uri },
      { shouldPlay: true },
    );
    setSound(snd);
    setIsPlaying(true);
    snd.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && st.didJustFinish) {
        setIsPlaying(false);
        snd.setPositionAsync(0);
      }
    });
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((p) => [...p, t]);
      markDirty();
    }
    setTagInput("");
    setShowTagInput(false);
  };

  if (noteLoading && !isNew) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
            <Text style={s.backLabel}>Ghi chu</Text>
          </TouchableOpacity>

          <View style={s.topCenter} pointerEvents="none">
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.textDim} />
            ) : (
              <>
                <Animated.Text
                  style={[s.savedBadge, { opacity: savedOpacity }]}
                >
                  Saved
                </Animated.Text>
                <Text style={s.dateText}>
                  {note ? fmtDate(note.updated_at) : "Ghi chu moi"}
                </Text>
              </>
            )}
          </View>

          <View style={s.topRight}>
            {sessionNoteIdRef.current !== null && (
              <TouchableOpacity
                style={s.topBtn}
                onPress={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : (
                  <Ionicons name="sparkles" size={19} color={COLORS.accent} />
                )}
              </TouchableOpacity>
            )}
            {extracted && (
              <TouchableOpacity
                style={s.topBtn}
                onPress={() => setShowExtracted((v) => !v)}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={19}
                  color={showExtracted ? COLORS.accent : COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.topBtn, saving && { opacity: 0.5 }]}
              onPress={() => doSave(true)}
              disabled={saving}
            >
              <Ionicons name="checkmark" size={19} color={COLORS.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={s.topBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          ref={titleRef}
          style={s.titleInput}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            markDirty();
          }}
          placeholder="Tieu de"
          placeholderTextColor={COLORS.textDim}
          multiline
          returnKeyType="next"
          blurOnSubmit
        />

        <View style={s.tagsRow}>
          {tags.map((t) => (
            <TouchableOpacity
              key={t}
              style={s.tagChip}
              onPress={() => {
                setTags((p) => p.filter((x) => x !== t));
                markDirty();
              }}
            >
              <Text style={s.tagChipTx}>#{t} x</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={s.tagAddBtn}
            onPress={() => setShowTagInput((v) => !v)}
          >
            <Ionicons
              name="pricetag-outline"
              size={11}
              color={COLORS.textDim}
            />
            <Text style={s.tagAddTx}>tag</Text>
          </TouchableOpacity>
        </View>

        {showTagInput && (
          <View style={s.tagInputRow}>
            <TextInput
              style={s.tagField}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="#ten-tag"
              placeholderTextColor={COLORS.textDim}
              onSubmitEditing={addTag}
              returnKeyType="done"
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity style={s.tagConfirmBtn} onPress={addTag}>
              <Text style={s.tagConfirmTx}>Them</Text>
            </TouchableOpacity>
          </View>
        )}

        {showExtracted && extracted && (
          <View style={s.extractedCard}>
            <Text style={s.extractedTitle}>AI trich xuat</Text>
            {extracted.summary && (
              <Text style={s.extractedRow}>{extracted.summary}</Text>
            )}
            {extracted.person_name && (
              <Text style={s.extractedRow}>👤 {extracted.person_name}</Text>
            )}
            {extracted.phone && (
              <Text style={s.extractedRow}>📞 {extracted.phone}</Text>
            )}
            {extracted.email && (
              <Text style={s.extractedRow}>✉️ {extracted.email}</Text>
            )}
            {extracted.organization && (
              <Text style={s.extractedRow}>🏢 {extracted.organization}</Text>
            )}
            {extracted.event_title && (
              <Text style={s.extractedRow}>📅 {extracted.event_title}</Text>
            )}
            {extracted.deadline && (
              <Text style={s.extractedRow}>⏰ {extracted.deadline}</Text>
            )}
            {extracted.address && (
              <Text style={s.extractedRow}>📍 {extracted.address}</Text>
            )}
          </View>
        )}

        {audioState && (
          <View style={s.audioChip}>
            <TouchableOpacity style={s.audioPlayBtn} onPress={togglePlay}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={16}
                color={COLORS.accent}
              />
            </TouchableOpacity>
            <Text style={s.audioDur}>
              {fmtDur(audioState.duration)}
              {uploadingAudio
                ? "  (uploading...)"
                : audioState.uploaded
                  ? "  ✓"
                  : ""}
            </Text>
            <TouchableOpacity
              onPress={() => {
                sound?.unloadAsync();
                setSound(null);
                setAudioState(null);
              }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
            </TouchableOpacity>
          </View>
        )}

        <FileAttachmentBar
          noteId={sessionNoteIdRef.current ?? undefined}
          attachments={fileAttach}
          onChange={(files) => {
            setFileAttach(files);
            markDirty();
          }}
        />

        <View style={s.hairline} />

        <View style={s.editorWrap}>
          <RichText editor={editor} style={s.richText} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.attachBar}>
            <TouchableOpacity style={s.attachBtn} onPress={handlePickImage}>
              <Ionicons
                name="image-outline"
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity style={s.attachBtn} onPress={handleCamera}>
              <Ionicons
                name="camera-outline"
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.attachBtn, isRecording && s.attachBtnRec]}
              onPress={isRecording ? stopRec : startRec}
            >
              <Ionicons
                name={isRecording ? "stop-circle" : "mic-outline"}
                size={20}
                color={isRecording ? COLORS.danger : COLORS.textMuted}
              />
              <Text
                style={[s.attachLabel, isRecording && { color: COLORS.danger }]}
              >
                {isRecording ? fmtDur(recSec) : undefined}
              </Text>
              {isRecording && <View style={s.recDot} />}
            </TouchableOpacity>
            <View style={s.toolbarWrap}>
              <Toolbar editor={editor} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 80 },
  backLabel: { fontSize: 16, color: COLORS.accent },
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
  titleInput: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 34,
    letterSpacing: -0.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tagChip: {
    backgroundColor: COLORS.active,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipTx: { fontSize: 12, color: COLORS.accent, fontWeight: "600" },
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
  tagAddTx: { fontSize: 12, color: COLORS.textDim },
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
  tagConfirmTx: { color: "#fff", fontSize: 13, fontWeight: "600" },
  extractedCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
    gap: 6,
  },
  extractedTitle: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: "700",
    marginBottom: 2,
  },
  extractedRow: { fontSize: 13, color: COLORS.text, lineHeight: 19 },
  audioChip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  audioPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.active,
    alignItems: "center",
    justifyContent: "center",
  },
  audioDur: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  editorWrap: {
    flex: 1,
    paddingHorizontal: 8,
    backgroundColor: COLORS.background,
  },
  richText: { flex: 1, backgroundColor: COLORS.background },
  attachBar: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  attachBtnRec: {
    backgroundColor: COLORS.danger + "15",
    borderColor: COLORS.danger + "60",
  },
  attachLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "500" },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.danger,
    marginLeft: 2,
  },
  toolbarWrap: {
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
});
