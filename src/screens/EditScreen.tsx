import {
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
}

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

// ── Convert local image URI -> base64 data URI ──────────────────────────────
// Tránh dùng file:// trực tiếp trong WebView — base64 hoạt động mọi version
async function uriToBase64(
  uri: string,
  mimeType = "image/jpeg",
): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
  return `data:${mimeType};base64,${b64}`;
}

export default function EditScreen({ route, navigation }: Props) {
  const noteId = route.params?.noteId;
  const isNew = noteId === undefined;

  const {
    note,
    extracted,
    loading: noteLoading,
    reload,
  } = useNoteDetail(noteId);

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

  const titleRef = useRef<TextInput>(null);
  const isDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedOpacity = useRef(new Animated.Value(0)).current;

  // ── TenTap — v1.x không cần ghi editorHtml ra file system ─────────────
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: "",
    bridgeExtensions: TenTapStartKit,
    onChange: () => markDirty(),
  });
  const editorContent = useEditorContent(editor, { type: "html" });

  // ── Sync note -> editor ────────────────────────────────────────────────
  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? "");
    setTags(parseTags(note.tags));
    const json = (note as any).content_json;
    if (json) {
      try {
        editor.setContent(JSON.parse(json));
      } catch {}
    } else if (note.content) {
      editor.setContent(`<p>${note.content.replace(/\n/g, "</p><p>")}</p>`);
    }
  }, [note]);

  useFocusEffect(
    useCallback(() => {
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

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!isDirty.current) return;
      e.preventDefault();
      doSave(false).then(() => navigation.dispatch(e.data.action));
    });
    return unsub;
  }, [navigation, title, tags, editorContent]);

  useEffect(
    () => () => {
      sound?.unloadAsync();
    },
    [sound],
  );

  // ── Save helpers ───────────────────────────────────────────────────────
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

  const doSave = useCallback(
    async (spinner: boolean) => {
      const cj =
        editorContent == null
          ? ""
          : typeof editorContent === "string"
            ? editorContent
            : JSON.stringify(editorContent); // object → stringify
      if (!title.trim() && !cj) return;
      try {
        if (spinner) setSaving(true);
        if (note) {
          await updateNote(note.id, {
            title,
            content_json: cj,
            tags: JSON.stringify(tags),
          });
        }
        isDirty.current = false;
        flashSaved();
      } catch (e) {
        if (spinner)
          Alert.alert("Loi", e instanceof Error ? e.message : "Luu that bai");
      } finally {
        if (spinner) setSaving(false);
      }
    },
    [editorContent, note, tags, title],
  );

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (isNew) {
      navigation.goBack();
      return;
    }
    Alert.alert("Xoa ghi chu", "Khong the khoi phuc?", [
      { text: "Huy", style: "cancel" },
      {
        text: "Xoa",
        style: "destructive",
        onPress: async () => {
          if (!note) return;
          await deleteNote(note.id);
          isDirty.current = false;
          navigation.goBack();
        },
      },
    ]);
  };

  // ── AI Analyze ─────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!note) return;
    setAnalyzing(true);
    try {
      await doSave(false);
      await analyzeNote(note.id);
      await reload();
      setShowExtracted(true);
    } catch {
      Alert.alert("Loi", "Khong the phan tich. Kiem tra backend.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Image picker — convert to base64 để tránh file:// issue ───────────
  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Can quyen anh");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      // Base64 data URI — hoạt động trong WebView mọi platform
      const dataUri = await uriToBase64(asset.uri, "image/jpeg");
      editor.setImage(dataUri);
      markDirty();
      // Upload as attachment nếu note đã có id
      if (noteId) {
        const att = await uploadAttachment(
          noteId,
          asset.uri,
          `photo_${Date.now()}.jpg`,
          "image/jpeg",
        );
        setFileAttach((prev) => [...prev, att]);
      }
    } catch (e) {
      Alert.alert("Loi", "Khong the them anh.");
    }
  };

  // ── Camera ─────────────────────────────────────────────────────────────
  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Can quyen camera");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    try {
      const dataUri = await uriToBase64(res.assets[0].uri, "image/jpeg");
      editor.setImage(dataUri);
      markDirty();
    } catch {
      Alert.alert("Loi", "Khong the them anh tu camera.");
    }
  };

  // ── Audio record ───────────────────────────────────────────────────────
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
    if (uri) setAudioState({ uri, duration: recSec, uploaded: false });
    setRecording(null);
    setIsRecording(false);
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

  // ── Tags ───────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((p) => [...p, t]);
      markDirty();
    }
    setTagInput("");
    setShowTagInput(false);
  };

  if (noteLoading) {
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
        {/* TOP BAR */}
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
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
            {!isNew && (
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

        {/* TITLE */}
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

        {/* TAGS */}
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

        {/* AI EXTRACTED PANEL */}
        {showExtracted && extracted && (
          <View style={s.extractedCard}>
            <Text style={s.extractedTitle}>AI trich xuat</Text>
            {extracted.person_name && (
              <Text style={s.extractedRow}>
                Person: {extracted.person_name}
              </Text>
            )}
            {extracted.phone && (
              <Text style={s.extractedRow}>Phone: {extracted.phone}</Text>
            )}
            {extracted.email && (
              <Text style={s.extractedRow}>Email: {extracted.email}</Text>
            )}
            {extracted.event_title && (
              <Text style={s.extractedRow}>Event: {extracted.event_title}</Text>
            )}
            {extracted.deadline && (
              <Text style={s.extractedRow}>Deadline: {extracted.deadline}</Text>
            )}
          </View>
        )}

        {/* AUDIO CHIP */}
        {audioState && (
          <View style={s.audioChip}>
            <TouchableOpacity style={s.audioPlayBtn} onPress={togglePlay}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={16}
                color={COLORS.accent}
              />
            </TouchableOpacity>
            <Text style={s.audioDur}>{fmtDur(audioState.duration)}</Text>
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

        {/* FILE ATTACHMENTS */}
        <FileAttachmentBar
          noteId={noteId}
          attachments={fileAttach}
          onChange={(files) => {
            setFileAttach(files);
            markDirty();
          }}
        />

        <View style={s.hairline} />

        {/* TENTAP EDITOR — v1.x: dùng trực tiếp, không cần source/editorHtml */}
        <RichText editor={editor} style={s.richText} />

        {/* ATTACHMENT BAR + TOOLBAR */}
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
              <Text style={s.attachLabel}>Anh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachBtn} onPress={handleCamera}>
              <Ionicons
                name="camera-outline"
                size={20}
                color={COLORS.textMuted}
              />
              <Text style={s.attachLabel}>Camera</Text>
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
                {isRecording ? fmtDur(recSec) : "Ghi am"}
              </Text>
              {isRecording && <View style={s.recDot} />}
            </TouchableOpacity>
          </View>
          <Toolbar editor={editor} />
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
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  extractedTitle: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: "700",
    marginBottom: 8,
  },
  extractedRow: { fontSize: 13, color: COLORS.text, marginBottom: 4 },
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
  toolbar: {
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
});
