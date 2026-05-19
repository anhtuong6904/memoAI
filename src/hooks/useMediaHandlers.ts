import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { uploadAttachment } from "../services/api";

export function useMediaHandlers({
  richRef,
  ensureId,
  dirty,
  pollHeight,
}: {
  richRef: React.RefObject<any>;
  ensureId: () => Promise<number>;
  dirty: React.MutableRefObject<boolean>;
  pollHeight: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 1000);

  const resizeImage = async (uri: string): Promise<string> => {
    const ref = await ImageManipulator.manipulate(uri)
      .resize({ width: 540 })
      .renderAsync();
    const result = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    return result.uri;
  };

  const handleImg = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) { Alert.alert("Cần quyền thư viện ảnh"); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    try {
      setBusy(true);
      const resizedUri = await resizeImage(r.assets[0].uri);
      const id = await ensureId();
      const att = await uploadAttachment(id, resizedUri, `photo_${Date.now()}.jpg`, "image/jpeg");
      if (att.remoteUrl) {
        const srcW = r.assets[0].width ?? 1;
        const srcH = r.assets[0].height ?? 1;
        richRef.current?.insertHTML(
          `<img src="${att.remoteUrl}" style="display:block;max-width:100%;height:auto;max-height:540px;aspect-ratio:${srcW}/${srcH};border-radius:10px;margin:10px 0;" />`,
        );
        dirty.current = true;
        pollHeight();
      }
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thêm được ảnh.");
    } finally {
      setBusy(false);
    }
  };

  const handleCam = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert("Cần quyền camera"); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    try {
      setBusy(true);
      const resizedUri = await resizeImage(r.assets[0].uri);
      const id = await ensureId();
      const att = await uploadAttachment(id, resizedUri, `cam_${Date.now()}.jpg`, "image/jpeg");
      if (att.remoteUrl) {
        const srcW = r.assets[0].width ?? 1;
        const srcH = r.assets[0].height ?? 1;
        richRef.current?.insertHTML(
          `<img src="${att.remoteUrl}" style="display:block;max-width:100%;height:auto;max-height:540px;aspect-ratio:${srcW}/${srcH};border-radius:10px;margin:10px 0;" />`,
        );
        dirty.current = true;
        pollHeight();
      }
    } catch {
      Alert.alert("Lỗi", "Không thể chụp ảnh.");
    } finally {
      setBusy(false);
    }
  };

  const handleVid = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) { Alert.alert("Cần quyền thư viện"); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    try {
      setBusy(true);
      const id = await ensureId();
      const ext = a.uri.split(".").pop() ?? "mp4";
      const att = await uploadAttachment(id, a.uri, `vid_${Date.now()}.${ext}`, a.mimeType ?? "video/mp4");
      if (att.remoteUrl) {
        richRef.current?.insertVideo(att.remoteUrl);
        dirty.current = true;
        pollHeight();
      }
    } catch {
      Alert.alert("Lỗi", "Không thể thêm video.");
    } finally {
      setBusy(false);
    }
  };

  const handleAud = useCallback(async () => {
    if (recState.isRecording) {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        const dur = Math.floor((recState.durationMillis ?? 0) / 1000);
        if (!uri) return;
        setBusy(true);
        try {
          const id = await ensureId();
          const att = await uploadAttachment(id, uri, `rec_${Date.now()}.m4a`, "audio/m4a");
          if (att.remoteUrl) {
            const mins = Math.floor(dur / 60);
            const secs = String(dur % 60).padStart(2, "0");
            const durStr = `${mins}:${secs}`;
            richRef.current?.insertHTML(
              `<p>&#8203;<span class="att-chip" contenteditable="false" data-url="${att.remoteUrl}" data-name="${att.name}" data-mime="audio/m4a"><span class="att-ic">🎙️</span><span class="att-body"><span class="att-name">${att.name}</span><span class="att-meta">Âm thanh · ${durStr}</span></span></span>&#8203;</p>`,
            );
            dirty.current = true;
            pollHeight();
          }
        } finally {
          setBusy(false);
        }
      } catch {
        Alert.alert("Lỗi", "Không thể lưu âm thanh.");
      }
      return;
    }
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert("Cần quyền micro"); return; }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert("Lỗi", "Không thể ghi âm.");
    }
  }, [recState.isRecording, recState.durationMillis, recorder, ensureId, dirty, pollHeight, richRef]);

  const handleFile = useCallback(async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      setBusy(true);
      try {
        const id = await ensureId();
        const att = await uploadAttachment(id, a.uri, a.name, a.mimeType ?? "application/octet-stream");
        if (att.remoteUrl) {
          const mime = a.mimeType ?? "application/octet-stream";
          const ic =
            mime === "application/pdf" ? "📄"
            : mime.includes("word") || mime.includes("document") ? "📝"
            : mime.includes("sheet") || mime.includes("excel") ? "📊"
            : mime.includes("zip") || mime.includes("rar") ? "🗜️"
            : mime.startsWith("text/") ? "📃"
            : "📎";
          const sizeTx = a.size ? `${Math.round(a.size / 1024)} KB` : "";
          const meta = sizeTx ? `Tệp đính kèm · ${sizeTx}` : "Tệp đính kèm";
          richRef.current?.insertHTML(
            `<p>&#8203;<span class="att-chip" contenteditable="false" data-url="${att.remoteUrl}" data-name="${a.name}" data-mime="${mime}"><span class="att-ic">${ic}</span><span class="att-body"><span class="att-name">${a.name}</span><span class="att-meta">${meta}</span></span></span>&#8203;</p>`,
          );
          dirty.current = true;
          pollHeight();
        }
      } finally {
        setBusy(false);
      }
    } catch {
      Alert.alert("Lỗi", "Không thể đính kèm file.");
    }
  }, [ensureId, dirty, pollHeight, richRef]);

  const recDur = Math.floor((recState.durationMillis ?? 0) / 1000);

  return { busy, recState, recDur, handleImg, handleCam, handleVid, handleAud, handleFile };
}
