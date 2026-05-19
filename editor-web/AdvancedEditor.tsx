import { TenTapStartKit, useTenTap } from "@10play/tentap-editor";
import { EditorContent } from "@tiptap/react";
import { AudioBridge } from "./bridges/AudioBridge";
import { FileBridge } from "./bridges/FileBridge";
import { VideoBridge } from "./bridges/VideoBridge";

export const AdvancedEditor = () => {
  const editor = useTenTap({
    bridges: [
      ...TenTapStartKit,
      AudioBridge,
      VideoBridge,
      FileBridge,
    ],
  });
  return (
    <EditorContent
      editor={editor}
      className={window.dynamicHeight ? "dynamic-height" : undefined}
    />
  );
};
