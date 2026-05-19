import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { EDITOR_INIT_JS } from "../constants/editorStyles";

export function useNoteEditor({
  richRef,
  pollHeight,
  setContentH,
  setPlayingAudio,
  htmlRef,
  dirty,
}: {
  richRef: React.RefObject<any>;
  pollHeight: () => void;
  setContentH: React.Dispatch<React.SetStateAction<number>>;
  setPlayingAudio: React.Dispatch<
    React.SetStateAction<{ uri: string; name: string } | null>
  >;
  htmlRef: React.MutableRefObject<string>;
  dirty: React.MutableRefObject<boolean>;
}) {
  const suppress = useRef(false);
  const supTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorReady = useRef(false);
  const pendingHtml = useRef<string | null>(null);

  const setEditorHTML = useCallback(
    (html: string) => {
      suppress.current = true;
      htmlRef.current = html;
      richRef.current?.setContentHTML(html);
      if (supTimer.current) clearTimeout(supTimer.current);
      supTimer.current = setTimeout(() => {
        suppress.current = false;
        supTimer.current = null;
      }, 500);
      pollHeight();
    },
    [htmlRef, richRef, pollHeight],
  );

  const onEditorChange = useCallback(
    (html: string) => {
      if (!suppress.current) {
        htmlRef.current = html;
        dirty.current = true;
      }
    },
    [htmlRef, dirty],
  );

  const onEditorInit = useCallback(() => {
    editorReady.current = true;
    if (pendingHtml.current !== null) {
      setEditorHTML(pendingHtml.current);
      pendingHtml.current = null;
    }
    richRef.current?.injectJavascript(EDITOR_INIT_JS);
  }, [setEditorHTML, richRef]);

  const onEditorMessage = useCallback(
    (message: any) => {
      if (
        message?.type === "HEIGHT_CHANGE" &&
        typeof message.height === "number" &&
        message.height > 0
      ) {
        setContentH(message.height);
      } else if (
        message?.type === "IMG_HEIGHT" &&
        typeof message.h === "number" &&
        message.h > 0
      ) {
        setContentH((prev) => Math.max(prev, message.h));
      } else if (message?.type === "OPEN_ATTACHMENT" && message.url) {
        const url: string = message.url;
        const name: string = message.name || "file";
        const mime: string = message.mime || "";
        if (mime.startsWith("audio/")) {
          setPlayingAudio({ uri: url, name });
        } else {
          WebBrowser.openBrowserAsync(url).catch(() =>
            Alert.alert("Lỗi", "Không thể mở file."),
          );
        }
      }
    },
    [setContentH, setPlayingAudio],
  );

  useEffect(
    () => () => {
      if (supTimer.current) clearTimeout(supTimer.current);
    },
    [],
  );

  return { editorReady, pendingHtml, setEditorHTML, onEditorChange, onEditorInit, onEditorMessage };
}
