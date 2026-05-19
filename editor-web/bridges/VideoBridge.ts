import { BridgeExtension } from "@10play/tentap-editor";
import { Node, mergeAttributes } from "@tiptap/core";

const VideoNode = Node.create({
  name: "videoNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: "Video" },
      mimeType: { default: "video/mp4" },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="video-node"]' }];
  },

  renderHTML({ node }) {
    return [
      "figure",
      mergeAttributes(
        { class: "video-node", "data-type": "video-node" },
        {
          "data-src": String(node.attrs.src ?? ""),
          "data-name": String(node.attrs.name ?? "Video"),
        },
      ),
      [
        "video",
        {
          class: "video-node-player",
          controls: "controls",
          src: String(node.attrs.src ?? ""),
          preload: "metadata",
          playsinline: "true",
          "webkit-playsinline": "true",
        },
      ],
      [
        "figcaption",
        { class: "video-node-caption" },
        String(node.attrs.name ?? "Video"),
      ],
    ];
  },
});

type VideoPayload = {
  src: string;
  name?: string;
  mimeType?: string;
};

type VideoEditorInstance = {
  insertVideo: (src: string, name?: string, mimeType?: string) => void;
};

declare module "@10play/tentap-editor" {
  interface EditorBridge extends VideoEditorInstance {}
}

export const VideoBridge = new BridgeExtension<
  {},
  VideoEditorInstance,
  VideoPayload
>({
  tiptapExtension: VideoNode,

  onBridgeMessage: (editor, payload) => {
    return editor.commands.insertContent({
      type: "videoNode",
      attrs: {
        src: payload.src,
        name: payload.name ?? "Video",
        mimeType: payload.mimeType ?? "video/mp4",
      },
    });
  },

  extendEditorInstance: (sendBridgeMessage) => ({
    insertVideo: (src, name, mimeType) =>
      sendBridgeMessage({ src, name, mimeType }),
  }),
});
