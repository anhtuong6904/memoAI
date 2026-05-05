import { Block, BlockType } from "../../types";

// ── UID generator ─────────────────────────────────────────────────────────────

let _uid = 0;
export const uid = () => `b_${Date.now()}_${_uid++}`;

// ── Markdown ↔ Blocks ─────────────────────────────────────────────────────────

export function textToBlocks(text: string): Block[] {
  if (!text.trim()) return [{ id: uid(), type: "text", content: "" }];

  const lines = text.split("\n");
  const result: Block[] = [];
  let pending: string[] = [];

  const flush = () => {
    if (!pending.length) return;
    result.push({ id: uid(), type: "text", content: pending.join("\n") });
    pending = [];
  };

  for (const line of lines) {
    if (/^### /.test(line)) {
      flush();
      result.push({ id: uid(), type: "heading3", content: line.slice(4) });
      continue;
    }
    if (/^## /.test(line)) {
      flush();
      result.push({ id: uid(), type: "heading2", content: line.slice(3) });
      continue;
    }
    if (/^# /.test(line)) {
      flush();
      result.push({ id: uid(), type: "heading1", content: line.slice(2) });
      continue;
    }
    if (/^- \[x\] /i.test(line)) {
      flush();
      result.push({
        id: uid(),
        type: "checkbox",
        content: line.slice(6),
        checked: true,
      });
      continue;
    }
    if (/^- \[ \] /.test(line)) {
      flush();
      result.push({
        id: uid(),
        type: "checkbox",
        content: line.slice(6),
        checked: false,
      });
      continue;
    }
    if (/^- /.test(line)) {
      flush();
      result.push({ id: uid(), type: "bullet", content: line.slice(2) });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      flush();
      const m = line.match(/^\d+\. (.*)/);
      result.push({ id: uid(), type: "numbered", content: m ? m[1] : line });
      continue;
    }
    if (/^> /.test(line)) {
      flush();
      result.push({ id: uid(), type: "quote", content: line.slice(2) });
      continue;
    }
    if (/^---$/.test(line.trim())) {
      flush();
      result.push({ id: uid(), type: "divider", content: "" });
      continue;
    }
    pending.push(line);
  }

  flush();
  return result.length ? result : [{ id: uid(), type: "text", content: "" }];
}

export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading1":
          return `# ${b.content}`;
        case "heading2":
          return `## ${b.content}`;
        case "heading3":
          return `### ${b.content}`;
        case "bullet":
          return `- ${b.content}`;
        case "numbered":
          return `1. ${b.content}`;
        case "checkbox":
          return b.checked ? `- [x] ${b.content}` : `- [ ] ${b.content}`;
        case "quote":
          return `> ${b.content}`;
        case "divider":
          return "---";
        default:
          return b.content;
      }
    })
    .join("\n");
}

// ── Misc utils ────────────────────────────────────────────────────────────────

export const parseTags = (raw: string): string[] => {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const LIST_TYPES: BlockType[] = ["bullet", "numbered", "checkbox"];

export const TOOLBAR_ITEMS: { id: BlockType | "divider"; label: string }[] = [
  { id: "heading1", label: "H1" },
  { id: "heading2", label: "H2" },
  { id: "heading3", label: "H3" },
  { id: "bullet", label: "•" },
  { id: "numbered", label: "1." },
  { id: "checkbox", label: "☐" },
  { id: "quote", label: '"' },
  { id: "divider", label: "—" },
];
