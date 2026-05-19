import { BridgeExtension } from "@10play/tentap-editor";
import { Node, mergeAttributes } from "@tiptap/core";

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(name: string, mime: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf" || mime.includes("pdf")) return "📄";
  if (["doc", "docx"].includes(ext) || mime.includes("word")) return "📝";
  if (["xls", "xlsx"].includes(ext) || mime.includes("spreadsheet"))
    return "📊";
  if (["ppt", "pptx"].includes(ext) || mime.includes("presentation"))
    return "📑";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext) || mime.includes("audio"))
    return "🎵";
  if (["mp4", "mov", "avi", "mkv"].includes(ext) || mime.includes("video"))
    return "🎬";
  if (
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ||
    mime.includes("image")
  )
    return "🖼️";
  if (["txt", "md"].includes(ext) || mime.includes("text/plain")) return "📃";
  if (["json", "xml", "csv", "yaml", "yml"].includes(ext)) return "📋";
  return "📁";
}

const FileNode = Node.create({
  name: "fileNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: "File" },
      size: { default: 0 },
      mimeType: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-node"]' }];
  },

  renderHTML({ node }) {
    const icon = fileEmoji(
      String(node.attrs.name ?? ""),
      String(node.attrs.mimeType ?? ""),
    );
    const sizeLabel = fmtSize(Number(node.attrs.size) || 0);

    return [
      "a",
      mergeAttributes(
        { class: "file-node", "data-type": "file-node" },
        {
          href: String(node.attrs.src ?? "#"),
          target: "_blank",
          rel: "noopener noreferrer",
          "data-name": String(node.attrs.name ?? "File"),
        },
      ),
      ["span", { class: "file-node-icon" }, icon],
      [
        "div",
        { class: "file-node-info" },
        ["p", { class: "file-node-name" }, String(node.attrs.name ?? "File")],
        ...(sizeLabel
          ? [["p", { class: "file-node-size" }, sizeLabel] as any]
          : []),
      ],
      ["span", { class: "file-node-arrow" }, "↗"],
    ];
  },
});

type FilePayload = {
  src: string;
  name: string;
  size?: number;
  mimeType?: string;
};

type FileEditorInstance = {
  insertFile: (
    src: string,
    name: string,
    size?: number,
    mimeType?: string,
  ) => void;
};

declare module "@10play/tentap-editor" {
  interface EditorBridge extends FileEditorInstance {}
}

export const FileBridge = new BridgeExtension<
  {},
  FileEditorInstance,
  FilePayload
>({
  tiptapExtension: FileNode,

  onBridgeMessage: (editor, payload) => {
    return editor.commands.insertContent({
      type: "fileNode",
      attrs: {
        src: payload.src,
        name: payload.name,
        size: payload.size ?? 0,
        mimeType: payload.mimeType ?? "",
      },
    });
  },

  extendEditorInstance: (sendBridgeMessage) => ({
    insertFile: (src, name, size, mimeType) =>
      sendBridgeMessage({ src, name, size, mimeType }),
  }),
});
