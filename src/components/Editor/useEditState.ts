import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated } from "react-native";

import { useNoteDetail } from "../../hooks/useNotes";
import {
  captureText,
  createNote,
  deleteNote,
  updateNote,
} from "../../services/api";
import { Block, BlockType } from "../../types";
import {
  LIST_TYPES,
  blocksToText,
  parseTags,
  textToBlocks,
  uid,
} from "./helpers";

interface UseEditStateOptions {
  noteId?: number;
  onNavigateReplace: (noteId: number) => void;
  onNavigateBack: () => void;
}

export function useEditState({
  noteId,
  onNavigateReplace,
  onNavigateBack,
}: UseEditStateOptions) {
  const isNew = noteId === undefined;
  const {
    note,
    extracted,
    loading: noteLoading,
    reload: reloadNote,
  } = useNoteDetail(noteId);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [rawMarkdown, setRawMarkdown] = useState("");

  // ── Block state ─────────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState<Block[]>([
    { id: uid(), type: "text", content: "" },
  ]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slashVisible, setSlashVisible] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const isDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOpacity = useRef(new Animated.Value(0)).current;
  const unsavedDot = useRef(new Animated.Value(0)).current;

  // ── Sync when note loads ────────────────────────────────────────────────────
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

  // Parse rawMarkdown → blocks on edit mode enter
  useEffect(() => {
    if (isEditing) setBlocks(textToBlocks(rawMarkdown));
  }, [isEditing]);

  // ── Animations ──────────────────────────────────────────────────────────────
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

  // ── Save ────────────────────────────────────────────────────────────────────
  const doSave = useCallback(
    async (showSpinner: boolean) => {
      const content = (isEditing ? blocksToText(blocks) : rawMarkdown).trim();
      if (!title.trim() && !content) return;
      try {
        if (showSpinner) setSaving(true);
        if (isNew) {
          const newNote = await createNote(content || " ", title || "");
          isDirty.current = false;
          flashSaved();
          onNavigateReplace(newNote.id);
        } else if (note) {
          await updateNote(note.id, {
            title: title || "",
            content: content || " ",
            tags: JSON.stringify(tags),
          });
          setRawMarkdown(content || " ");
          isDirty.current = false;
          flashSaved();

        }
      } catch (e) {
        if (showSpinner)
          Alert.alert("Lỗi", e instanceof Error ? e.message : "Lưu thất bại");
      } finally {
        if (showSpinner) setSaving(false);
      }
    },
    [blocks, isEditing, isNew, note, rawMarkdown, tags, title],
  );

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (isNew) {
      onNavigateBack();
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
          onNavigateBack();
        },
      },
    ]);
  };

  // ── AI Analyze ──────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!note) return;
    setAnalyzing(true);
    try {
      await captureText(rawMarkdown.trim());
      await reloadNote();
      setShowExtracted(true);
    } catch {
      Alert.alert("Lỗi", "Không thể phân tích. Kiểm tra backend.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Checkbox toggle (view mode) ─────────────────────────────────────────────
  const handleCheckboxToggle = useCallback(
    (newMd: string) => {
      setRawMarkdown(newMd);
      if (note) updateNote(note.id, { content: newMd }).catch(() => {});
    },
    [note],
  );

  // ── Block editing ────────────────────────────────────────────────────────────
  const changeBlockText = (id: string, text: string) => {
    markDirty();
    if (slashVisible && slashBlockId === id) {
      if (!text.includes("/")) {
        setSlashVisible(false);
        setSlashBlockId(null);
        setSlashQuery("");
      } else setSlashQuery(text.slice(text.lastIndexOf("/") + 1));
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

  const applySlashCommand = (type: BlockType) => {
    if (!slashBlockId) return;
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

  // ── Tags ─────────────────────────────────────────────────────────────────────
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

  // ── Numbered index map ────────────────────────────────────────────────────────
  const numberedIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    let count = 0;
    for (const b of blocks) {
      if (b.type === "numbered") map[b.id] = ++count;
      else count = 0;
    }
    return map;
  }, [blocks]);

  const handleSavePress = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    doSave(true);
  };

  return {
    // note data
    note,
    extracted,
    noteLoading,
    isNew,
    // edit mode
    isEditing,
    setIsEditing,
    saving,
    analyzing,
    showExtracted,
    setShowExtracted,
    // content
    title,
    setTitle: (t: string) => {
      setTitle(t);
      markDirty();
    },
    rawMarkdown,
    // blocks
    blocks,
    focusedId,
    setFocusedId,
    numberedIndexMap,
    // slash
    slashVisible,
    slashQuery,
    // tags
    tags,
    tagInput,
    setTagInput,
    showTagInput,
    setShowTagInput,
    addTag,
    removeTag,
    // animations
    savedOpacity,
    unsavedDot,
    // handlers
    markDirty,
    doSave,
    handleSavePress,
    handleDelete,
    handleAnalyze,
    handleCheckboxToggle,
    changeBlockText,
    enterPress,
    backspaceEmpty,
    toggleCheck,
    applySlashCommand,
    applyFormat,
  };
}
