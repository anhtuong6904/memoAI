import { useCallback, useRef, useState } from "react";
import { Alert, Animated } from "react-native";
import {
  analyzeNote,
  createNote,
  getAllReminders,
  updateNote,
} from "../services/api";
import {
  scheduleReminderNotification,
  syncReminderNotifications,
} from "../services/notifications";
import { Reminder } from "../types";

export function useAutoSave({
  htmlRef,
  dirty,
  title,
  tags,
  noteIdRef,
  navigation,
}: {
  htmlRef: React.MutableRefObject<string>;
  dirty: React.MutableRefObject<boolean>;
  title: string;
  tags: string[];
  noteIdRef: React.MutableRefObject<number | null>;
  navigation: any;
}) {
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastAnalyzedAt = useRef<number>(0);
  const saveRef = useRef<(spinner: boolean) => Promise<void>>(async () => {});

  const flash = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim]);

  const ensureId = useCallback(async (): Promise<number> => {
    if (noteIdRef.current !== null) return noteIdRef.current;
    const n = await createNote("", title || "Ghi chú mới");
    noteIdRef.current = n.id;
    navigation.setParams({ noteId: n.id });
    return n.id;
  }, [title, navigation, noteIdRef]);

  const doSave = useCallback(
    async (spinner: boolean) => {
      const html = htmlRef.current;
      if (!title.trim() && !html.trim()) return;
      try {
        if (spinner) setSaving(true);
        const id = await ensureId();
        await updateNote(id, {
          title: title || "",
          content_json: html,
          tags: JSON.stringify(tags),
        });
        dirty.current = false;
        flash();
        const now = Date.now();
        if (now - lastAnalyzedAt.current >= 30_000) {
          lastAnalyzedAt.current = now;
          setAnalyzing(true);
          analyzeNote(id)
            .then((r) => {
              if (r.reminder) scheduleReminderNotification(r.reminder as Reminder);
              return getAllReminders();
            })
            .then(syncReminderNotifications)
            .catch((err) => console.warn("[Edit] analyze:", err))
            .finally(() => setAnalyzing(false));
        }
      } catch (e) {
        console.error("[Edit] doSave:", e);
        if (spinner)
          Alert.alert("Lỗi lưu", e instanceof Error ? e.message : "Lưu thất bại");
      } finally {
        if (spinner) setSaving(false);
      }
    },
    [ensureId, flash, tags, title, htmlRef, dirty],
  );
  saveRef.current = doSave;

  return { saving, analyzing, fadeAnim, ensureId, doSave, saveRef };
}
