import { BridgeExtension } from "@10play/tentap-editor";
import { Node, mergeAttributes } from "@tiptap/core";

const fmtDur = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const AudioNode = Node.create({
  name: "audioNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      duration: { default: 0 },
      name: { default: "Audio" },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="audio-node"]' }];
  },

  renderHTML({ node }) {
    return [
      "figure",
      mergeAttributes(
        { class: "audio-node", "data-type": "audio-node" },
        {
          "data-src": String(node.attrs.src ?? ""),
          "data-duration": String(node.attrs.duration ?? 0),
          "data-name": String(node.attrs.name ?? "Audio"),
        },
      ),
      [
        "div",
        { class: "audio-node-header" },
        ["span", { class: "audio-node-icon" }, "🎤"],
        [
          "div",
          { class: "audio-node-info" },
          [
            "p",
            { class: "audio-node-name" },
            String(node.attrs.name ?? "Audio Recording"),
          ],
          [
            "p",
            { class: "audio-node-dur" },
            fmtDur(Number(node.attrs.duration) || 0),
          ],
        ],
      ],
      [
        "audio",
        {
          class: "audio-node-player",
          controls: "controls",
          src: String(node.attrs.src ?? ""),
          preload: "metadata",
        },
      ],
    ];
  },
});

type AudioPayload = {
  src: string;
  duration?: number;
  name?: string;
};

type AudioEditorInstance = {
  insertAudio: (src: string, duration?: number, name?: string) => void;
};

declare module "@10play/tentap-editor" {
  interface EditorBridge extends AudioEditorInstance {}
}

export const AudioBridge = new BridgeExtension<
  {},
  AudioEditorInstance,
  AudioPayload
>({
  tiptapExtension: AudioNode,

  onBridgeMessage: (editor, payload) => {
    return editor.commands.insertContent({
      type: "audioNode",
      attrs: {
        src: payload.src,
        duration: payload.duration ?? 0,
        name: payload.name ?? "Audio Recording",
      },
    });
  },

  extendEditorInstance: (sendBridgeMessage) => ({
    insertAudio: (src, duration, name) =>
      sendBridgeMessage({ src, duration, name }),
  }),
});
