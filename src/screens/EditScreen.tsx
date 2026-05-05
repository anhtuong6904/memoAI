import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockItem from "../components/Editor/BlockItem";
import EditTagRow from "../components/Editor/EditTagRow";
import EditTopBar from "../components/Editor/EditTopbar";
import SlashMenu from "../components/Editor/SlashMenu";
import {
  LIST_TYPES,
  TOOLBAR_ITEMS,
  blocksToText,
  parseTags,
  textToBlocks,
  uid,
} from "../components/Editor/helpers";
import MarkdownViewer from "../components/MarkdownViewer";
import { COLORS } from "../constants/colors";
import { SERVER_URL } from "../constants/config";
import { useNoteDetail } from "../hooks/useNotes";
import {
  captureFile,
  captureImage,
  captureVoice,
  createNote,
  deleteNote,
  reanalyzeNote,
  updateNote,
} from "../services/api";
import { Block, BlockType, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Edit">;

/** ✅ Fix: build full URL từ relative file_path */
const buildFileUrl = (filePath?: string): string | undefined => {
  if (!filePath) return undefined;
  // Chuẩn hóa dấu \ → /
  const normalized = filePath.replace(/\\/g, "/");
  return `${SERVER_URL}/${normalized}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// EditScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function EditScreen({ route, navigation }: Props) {
  const noteId = route.params?.noteId;
  const isNew = noteId === undefined;

  const {
    note,
    extracted,
    loading: noteLoading,
    reload: reloadNote,
  } = useNoteDetail(noteId);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([
    { id: uid(), type: "text", content: "" },
  ]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slashVisible, setSlashVisible] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const titleRef = useRef<TextInput>(null);
  const isDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOpacity = useRef(new Animated.Value(0)).current;
  const unsavedDot = useRef(new Animated.Value(0)).current;

  // ── Sync note ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? "");
    setRawMarkdown(note.content ?? "");
    setTags(parseTags(note.tags));
    setIsEditing(false);
  }, [note]);

  useFocusEffect(
    useCallback(() => {
      reloadNote();
    }, [reloadNote]),
  );

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => titleRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (isEditing) setBlocks(textToBlocks(rawMarkdown));
  }, [isEditing]);

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!isDirty.current) return;
      e.preventDefault();
      doSave(false).then(() => navigation.dispatch(e.data.action));
    });
    return unsub;
  }, [navigation, title, blocks, tags, rawMarkdown]);

  // ── Animations ─────────────────────────────────────────────────────────────

  const flashSaved = () => {
    Animated.timing(unsavedDot, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
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
  };

  const markDirty = () => {
    if (!isDirty.current) {
      isDirty.current = true;
      Animated.timing(unsavedDot, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(false), 2500);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const uploadMediaBlocks = useCallback(
    async (targetNoteId: number) => {
      const mediaBlocks = blocks.filter(
        (b) => ["image", "audio", "video", "file"].includes(b.type) && !!b.uri,
      );
      for (const block of mediaBlocks) {
        if (!block.uri) continue;
        if (block.type === "image") {
          await captureImage(block.uri, undefined, targetNoteId);
          continue;
        }
        if (block.type === "audio") {
          await captureVoice(block.uri, undefined, targetNoteId);
          continue;
        }
        await captureFile(
          block.uri,
          block.fileName ??
            `${block.type}-${Date.now()}.${block.type === "video" ? "mp4" : "bin"}`,
          block.mimeType ??
            (block.type === "video" ? "video/mp4" : "application/octet-stream"),
          undefined,
          targetNoteId,
        );
      }
    },
    [blocks],
  );

  const doSave = useCallback(
    async (showSpinner: boolean) => {
      const content = (isEditing ? blocksToText(blocks) : rawMarkdown).trim();
      if (!title.trim() && !content) return;
      try {
        if (showSpinner) setSaving(true);
        if (isNew) {
          const newNote = await createNote(content || " ", title || "");
          await uploadMediaBlocks(newNote.id);
          isDirty.current = false;
          flashSaved();
          navigation.replace("Edit", { noteId: newNote.id });
        } else if (note) {
          await updateNote(note.id, {
            title: title || "",
            content: content || " ",
            tags: JSON.stringify(tags),
          });
          await uploadMediaBlocks(note.id);
          setRawMarkdown(content || " ");
          isDirty.current = false;
          flashSaved();
          setIsEditing(false);
          reloadNote();
        }
      } catch (e) {
        if (showSpinner)
          Alert.alert("Lỗi", e instanceof Error ? e.message : "Lưu thất bại");
      } finally {
        if (showSpinner) setSaving(false);
      }
    },
    [
      blocks,
      isEditing,
      isNew,
      note,
      rawMarkdown,
      reloadNote,
      tags,
      title,
      uploadMediaBlocks,
    ],
  );

  // ── Checkbox toggle (view mode) ────────────────────────────────────────────

  const handleCheckboxToggle = useCallback(
    (newMd: string) => {
      setRawMarkdown(newMd);
      if (note) updateNote(note.id, { content: newMd }).catch(() => {});
    },
    [note],
  );

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (isNew) {
      navigation.goBack();
      return;
    }
    Alert.alert("Xóa ghi chú", "Không thể khôi phục. Tiếp tục?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xóa",
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

  const handleShare = () =>
    Share.share({ message: `${title}\n\n${rawMarkdown}`.trim() });

  const handleAnalyze = async () => {
    if (!note) return;
    setAnalyzing(true);
    try {
      await reanalyzeNote(note.id);
      await reloadNote();
      setShowExtracted(true);
    } catch {
      Alert.alert("Lỗi", "Không thể phân tích. Kiểm tra backend.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Media pickers ──────────────────────────────────────────────────────────

  /** Chèn image block từ thư viện ảnh */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    insertMediaBlock({
      type: "image",
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    });
  };

  /** Chèn video block từ thư viện */
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    insertMediaBlock({
      type: "video",
      uri: asset.uri,
      fileName: asset.fileName ?? `video-${Date.now()}.mp4`,
      mimeType: asset.mimeType ?? "video/mp4",
      fileSize: asset.fileSize,
      duration: asset.duration ? asset.duration * 1000 : undefined, // s → ms
    });
  };

  /** Chèn file block từ document picker */
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      insertMediaBlock({
        type: "file",
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        fileSize: asset.size,
      });
    } catch {
      Alert.alert("Lỗi", "Không thể chọn file.");
    }
  };

  /**
   * Ghi âm — placeholder (cần expo-av để implement đầy đủ).
   * Hiện tại mở alert, có thể chọn audio từ thư viện.
   */
  const pickAudio = async () => {
    // Option 1: chọn audio file từ thư viện
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      insertMediaBlock({
        type: "audio",
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType ?? "audio/x-m4a",
        fileSize: asset.size,
      });
    } catch {
      Alert.alert("Lỗi", "Không thể chọn audio.");
    }
  };

  /** Chèn media block sau block đang focus (hoặc cuối cùng) */
  const insertMediaBlock = (params: Omit<Block, "id" | "content">) => {
    markDirty();
    const newBlock: Block = { id: uid(), content: "", ...params };
    if (focusedId) {
      const idx = blocks.findIndex((b) => b.id === focusedId);
      const next = [...blocks];
      next.splice(idx + 1, 0, newBlock);
      setBlocks(next);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }
    // Focus block text mới sau media
    const textBlock: Block = { id: uid(), type: "text", content: "" };
    setTimeout(() => {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === newBlock.id);
        const next = [...prev];
        next.splice(idx + 1, 0, textBlock);
        return next;
      });
      setFocusedId(textBlock.id);
    }, 50);
  };

  // ── Block editing ──────────────────────────────────────────────────────────

  const changeBlockText = (id: string, text: string) => {
    markDirty();
    if (slashVisible && slashBlockId === id) {
      if (!text.includes("/")) {
        setSlashVisible(false);
        setSlashBlockId(null);
        setSlashQuery("");
      } else {
        setSlashQuery(text.slice(text.lastIndexOf("/") + 1));
      }
    }
    if (text.endsWith("/") && !slashVisible) {
      setSlashBlockId(id);
      setSlashQuery("");
      setSlashVisible(true);
    }
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content: text } : b)),
    );
  };

  const enterPress = (id: string) => {
    markDirty();
    const idx = blocks.findIndex((b) => b.id === id);
    const curr = blocks[idx];
    if (LIST_TYPES.includes(curr.type) && curr.content === "") {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, type: "text" } : b)),
      );
      return;
    }
    const nb: Block = {
      id: uid(),
      type: LIST_TYPES.includes(curr.type) ? curr.type : "text",
      content: "",
      checked: false,
    };
    const next = [...blocks];
    next.splice(idx + 1, 0, nb);
    setBlocks(next);
    setFocusedId(nb.id);
  };

  const backspaceEmpty = (id: string) => {
    if (blocks.length <= 1) return;
    markDirty();
    const idx = blocks.findIndex((b) => b.id === id);
    const prev = blocks[idx - 1];
    setBlocks(blocks.filter((b) => b.id !== id));
    if (prev) setFocusedId(prev.id);
  };

  const toggleCheck = (id: string) => {
    markDirty();
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)),
    );
  };

  /** Xóa block bất kỳ (dùng cho media) */
  const deleteBlock = (id: string) => {
    markDirty();
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const applySlashCommand = (type: BlockType) => {
    if (!slashBlockId) return;
    // Media types → mở picker, đừng tạo block text
    if (type === "image") {
      setSlashVisible(false);
      pickImage();
      return;
    }
    if (type === "video") {
      setSlashVisible(false);
      pickVideo();
      return;
    }
    if (type === "audio") {
      setSlashVisible(false);
      pickAudio();
      return;
    }
    if (type === "file") {
      setSlashVisible(false);
      pickFile();
      return;
    }

    markDirty();
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== slashBlockId) return b;
        const si = b.content.lastIndexOf("/");
        return {
          ...b,
          type,
          content: si >= 0 ? b.content.slice(0, si) : b.content,
        };
      }),
    );
    setSlashVisible(false);
    setSlashBlockId(null);
    setSlashQuery("");
  };

  const applyFormat = (type: BlockType | "divider") => {
    markDirty();
    if (type === "divider") {
      const nb: Block = { id: uid(), type: "divider", content: "" };
      if (focusedId) {
        const idx = blocks.findIndex((b) => b.id === focusedId);
        const next = [...blocks];
        next.splice(idx + 1, 0, nb);
        setBlocks(next);
      } else setBlocks((prev) => [...prev, nb]);
      return;
    }
    if (!focusedId) {
      const nb: Block = { id: uid(), type, content: "" };
      setBlocks((prev) => [...prev, nb]);
      setFocusedId(nb.id);
      return;
    }
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === focusedId
          ? { ...b, type: b.type === type ? "text" : type }
          : b,
      ),
    );
  };

  // ── Tags ───────────────────────────────────────────────────────────────────

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
      markDirty();
    }
    setTagInput("");
    setShowTagInput(false);
  };
  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
    markDirty();
  };

  // ── Numbered index ─────────────────────────────────────────────────────────

  const numberedIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    let count = 0;
    for (const b of blocks) {
      if (b.type === "numbered") {
        map[b.id] = ++count;
      } else {
        count = 0;
      }
    }
    return map;
  }, [blocks]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (noteLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const focusedBlock = blocks.find((b) => b.id === focusedId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <EditTopBar
          isNew={isNew}
          saving={saving}
          analyzing={analyzing}
          showExtracted={showExtracted}
          hasExtracted={!!extracted}
          updatedAt={note?.updated_at}
          savedOpacity={savedOpacity}
          unsavedDot={unsavedDot}
          onBack={() => navigation.goBack()}
          onToggleExtracted={() => setShowExtracted((v) => !v)}
          onAnalyze={handleAnalyze}
          onShare={handleShare}
          onDelete={handleDelete}
        />

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        {isEditing ? (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.editorPad}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <TextInput
                ref={titleRef}
                style={s.titleInput}
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  markDirty();
                }}
                placeholder="Tiêu đề"
                placeholderTextColor={COLORS.textDim}
                multiline
                returnKeyType="next"
                blurOnSubmit
                onSubmitEditing={() => blocks[0] && setFocusedId(blocks[0].id)}
              />

              {/* Tags */}
              <EditTagRow
                tags={tags}
                tagInput={tagInput}
                showTagInput={showTagInput}
                setTagInput={setTagInput}
                setShowTagInput={setShowTagInput}
                onAddTag={addTag}
                onRemoveTag={removeTag}
              />

              <View style={s.hairline} />

              {/* Blocks */}
              {blocks.map((block) => (
                <BlockItem
                  key={block.id}
                  block={block}
                  numberedIndex={numberedIndexMap[block.id] ?? 0}
                  isFocused={focusedId === block.id}
                  onChangeText={changeBlockText}
                  onFocus={setFocusedId}
                  onEnterPress={enterPress}
                  onBackspace={backspaceEmpty}
                  onToggleCheck={toggleCheck}
                  onDelete={deleteBlock}
                />
              ))}

              <TouchableOpacity
                style={s.tapZone}
                activeOpacity={1}
                onPress={() => {
                  const last = blocks[blocks.length - 1];
                  if (last) setFocusedId(last.id);
                }}
              />
            </ScrollView>

            {slashVisible && (
              <SlashMenu
                query={slashQuery}
                onSelect={applySlashCommand}
                onClose={() => setSlashVisible(false)}
              />
            )}
          </>
        ) : (
          // VIEW MODE
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <MarkdownViewer
              title={title}
              tags={tags}
              content={rawMarkdown}
              extractedInfo={showExtracted ? (extracted ?? null) : null}
              // ✅ Fix: build URL từ file_path, không dùng file_url
              mediaUrl={buildFileUrl(note?.file_path)}
              mediaType={note?.type}
              attachments={(note?.attachments ?? []).map((a) => ({
                ...a,
                file_path: buildFileUrl(a.file_path) || a.file_path,
              }))}
              onPress={() => setIsEditing(true)}
              onLinkPress={(url) => Linking.openURL(url).catch(() => {})}
              onCheckboxToggle={handleCheckboxToggle}
              showWordCount
              paddingHorizontal={16}
            />
          </ScrollView>
        )}

        {/* ── TOOLBAR 2 TẦNG — chỉ khi edit mode ──────────────────────────── */}
        {isEditing && (
          <View style={s.toolbar}>
            {/* Tầng 1: Format buttons (scroll ngang) */}
            <View style={s.toolRow1}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.toolRow1Items}
                keyboardShouldPersistTaps="always"
              >
                {TOOLBAR_ITEMS.map((item) => {
                  const active = focusedBlock?.type === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[s.formatBtn, active && s.formatBtnActive]}
                      onPress={() =>
                        applyFormat(item.id as BlockType | "divider")
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.formatBtnText,
                          active && s.formatBtnTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Tầng 2: Media + Save */}
            <View style={s.toolRow2}>
              {/* Media buttons */}
              <View style={s.mediaButtons}>
                <TouchableOpacity
                  style={s.mediaBtn}
                  onPress={pickImage}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="image-outline"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mediaBtn}
                  onPress={pickAudio}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="mic-outline"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mediaBtn}
                  onPress={pickVideo}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.mediaBtn}
                  onPress={pickFile}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="attach-outline"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Separator */}
              <View style={s.toolSep} />

              {/* Save button */}
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDim]}
                onPress={() => {
                  if (saveTimer.current) clearTimeout(saveTimer.current);
                  doSave(true);
                }}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Top bar
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

  // Editor
  editorPad: { paddingBottom: 24 },
  titleInput: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 36,
    letterSpacing: -0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
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
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },
  tapZone: { minHeight: 160 },

  // ── Toolbar 2 tầng ────────────────────────────────────────────────────────────
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },

  // Tầng 1: format buttons
  toolRow1: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  toolRow1Items: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    alignItems: "center",
  },
  formatBtn: {
    minWidth: 36,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  formatBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  formatBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  formatBtnTextActive: { color: "#fff" },

  // Tầng 2: media + save
  toolRow2: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  mediaButtons: {
    flexDirection: "row",
    gap: 2,
    flex: 1,
  },
  mediaBtn: {
    width: 40,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  toolSep: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: COLORS.border,
    marginHorizontal: 6,
  },
  saveBtn: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  saveBtnDim: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
