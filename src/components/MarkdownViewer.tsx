

import { Ionicons } from "@expo/vector-icons";
import React, { memo, useMemo, useRef } from "react";
import {
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { COLORS } from "../constants/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedInfoData {
  person_name?: string | null;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  place_name?: string | null;
  address?: string | null;
  event_title?: string | null;
  event_time?: string | null;
  deadline?: string | null;
  action_items?: string | null; // JSON string: ["task1","task2"]
  category?: string | null;
  reminder_needed?: number;
}

export interface MarkdownViewerProps {
  /** Nội dung markdown */
  content: string;

  // Document metadata
  title?: string;
  tags?: string[];
  extractedInfo?: ExtractedInfoData | null;

  // Media
  mediaUrl?: string;
  mediaType?: "image" | "voice" | "video" | "text";

  // Interaction
  /** Tap vào viewer → vào edit mode */
  onPress?: () => void;
  /** Tap link trong markdown */
  onLinkPress?: (url: string) => void;
  /** Tap checkbox → markdown mới */
  onCheckboxToggle?: (newMarkdown: string) => void;

  // Display
  showWordCount?: boolean;
  paddingHorizontal?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const FONT_MONO = Platform.OS === "ios" ? "Courier" : "monospace";

export function toggleCheckboxInMarkdown(
  md: string,
  targetIdx: number,
): string {
  let count = -1;
  return md.replace(/^(\s*- \[)([x ])(\])/gm, (_m, pre, state, post) => {
    count++;
    if (count !== targetIdx) return `${pre}${state}${post}`;
    return `${pre}${state === " " ? "x" : " "}${post}`;
  });
}

function calcReadStats(text: string) {
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/[#*>\-_~|]/g, " ")
    .trim();
  const words = clean ? clean.split(/\s+/).length : 0;
  return { words, minutes: Math.max(1, Math.ceil(words / 200)) };
}

function parseActionItems(raw?: string | null): string[] {
  if (!raw || raw === "[]") return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown styles — mergeStyle=true → chỉ override những gì cần
// ─────────────────────────────────────────────────────────────────────────────

export const mdStyles = {
  body: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: "transparent",
  },

  heading1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800" as const,
    lineHeight: 32,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  heading2: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700" as const,
    lineHeight: 28,
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "600" as const,
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 4,
  },

  paragraph: { marginTop: 0, marginBottom: 10, color: COLORS.text },
  strong: { fontWeight: "700" as const, color: COLORS.text },
  em: { fontStyle: "italic" as const, color: COLORS.textMuted },
  s: { textDecorationLine: "line-through" as const, color: COLORS.textDim },
  link: { color: COLORS.accent, textDecorationLine: "underline" as const },
  blocklink: { color: COLORS.accent },

  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: {
    marginBottom: 4,
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
  },
  bullet_list_icon: {
    color: COLORS.accent,
    fontSize: 15,
    lineHeight: 24,
    marginRight: 8,
  },
  ordered_list_icon: {
    color: COLORS.accent,
    fontSize: 15,
    lineHeight: 24,
    marginRight: 8,
  },
  bullet_list_content: { flex: 1, color: COLORS.text },
  ordered_list_content: { flex: 1, color: COLORS.text },

  blockquote: {
    backgroundColor: COLORS.surface,
    borderLeftColor: COLORS.accent,
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 6,
    marginVertical: 8,
    borderRadius: 4,
  },

  code_inline: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    fontFamily: FONT_MONO,
    fontSize: 13,
  },
  fence: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: COLORS.text,
  },
  code_block: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: COLORS.text,
  },

  hr: { backgroundColor: COLORS.border, height: 1, marginVertical: 14 },

  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: { backgroundColor: COLORS.surface },
  th: {
    padding: 8,
    fontWeight: "600" as const,
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  td: { padding: 8, color: COLORS.text },
  tr: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
};

// ─────────────────────────────────────────────────────────────────────────────
// Small sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TagPill({ label }: { label: string }) {
  const palette = [
    "#6C63FF",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#EC4899",
  ];
  let h = 0;
  for (let i = 0; i < label.length; i++)
    h = label.charCodeAt(i) + ((h << 5) - h);
  const color = palette[Math.abs(h) % palette.length];
  return (
    <View style={[sub.pill, { backgroundColor: color + "25" }]}>
      <Text style={[sub.pillText, { color }]}>#{label}</Text>
    </View>
  );
}

function ExRow({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={sub.exRow}>
      <Text style={sub.exIcon}>{icon}</Text>
      <Text style={sub.exValue}>{value}</Text>
    </View>
  );
}

/** Checkbox label: strip `[x] ` / `[ ] ` prefix và apply style */
function CbLabel({ node, done }: { node: any; done: boolean }) {
  const raw = node.children?.[0]?.children?.[0]?.content ?? "";
  const text = raw.replace(/^\[[ x]\] /i, "");
  return <Text style={[sub.cbLabel, done && sub.cbLabelDone]}>{text}</Text>;
}

const sub = StyleSheet.create({
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: "600" },

  exRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    alignItems: "flex-start",
  },
  exIcon: { fontSize: 14, width: 22 },
  exValue: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 20 },

  cbBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.textDim,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  cbBoxDone: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  cbTick: { fontSize: 11, color: "#fff", fontWeight: "700", lineHeight: 14 },
  cbLabel: { fontSize: 15, color: COLORS.text, lineHeight: 22, flex: 1 },
  cbLabelDone: { textDecorationLine: "line-through", color: COLORS.textDim },
});

// ─────────────────────────────────────────────────────────────────────────────
// MarkdownViewer
// ─────────────────────────────────────────────────────────────────────────────

const MarkdownViewer = memo(
  ({
    content,
    title,
    tags,
    extractedInfo,
    mediaUrl,
    mediaType,
    onPress,
    onLinkPress,
    onCheckboxToggle,
    showWordCount = false,
    paddingHorizontal = 16,
  }: MarkdownViewerProps) => {
    const cbCounter = useRef(0);

    const wordStats = useMemo(
      () =>
        showWordCount ? calcReadStats((title ?? "") + " " + content) : null,
      [content, title, showWordCount],
    );

    // ── Custom markdown rules ────────────────────────────────────────────────

    const rules = useMemo(() => {
      cbCounter.current = 0;

      return {
        // Checkbox list item — tương tác ngay trong view mode
        list_item: (
          node: any,
          children: React.ReactNode,
          _p: any,
          styles: any,
        ) => {
          const firstText = node.children?.[0]?.children?.[0]?.content ?? "";
          const isDone = /^\[x\] /i.test(firstText);
          const isOpen = /^\[ \] /i.test(firstText);

          if (!isDone && !isOpen) {
            return (
              <View key={node.key} style={styles.list_item}>
                {children}
              </View>
            );
          }

          const idx = cbCounter.current++;
          return (
            <TouchableOpacity
              key={node.key}
              style={[
                styles.list_item,
                { alignItems: "center", paddingVertical: 3 },
              ]}
              onPress={() =>
                onCheckboxToggle?.(toggleCheckboxInMarkdown(content, idx))
              }
              activeOpacity={onCheckboxToggle ? 0.6 : 1}
              disabled={!onCheckboxToggle}
            >
              <View style={[sub.cbBox, isDone && sub.cbBoxDone]}>
                {isDone && <Text style={sub.cbTick}>✓</Text>}
              </View>
              <CbLabel node={node} done={isDone} />
            </TouchableOpacity>
          );
        },

        // Link — custom handler, fallback Linking
        link: (node: any, children: React.ReactNode, _p: any, styles: any) => {
          const href: string = node.attributes?.href ?? "";
          return (
            <Text
              key={node.key}
              style={styles.link}
              onPress={() =>
                onLinkPress
                  ? onLinkPress(href)
                  : Linking.openURL(href).catch(() => {})
              }
            >
              {children}
            </Text>
          );
        },

        // Image inline trong markdown: ![alt](url)
        image: (node: any) => {
          const src: string = node.attributes?.src ?? "";
          if (!src) return null;
          return (
            <Image
              key={node.key}
              source={{ uri: src }}
              style={{
                width: "100%",
                height: 200,
                borderRadius: 8,
                marginVertical: 8,
              }}
              resizeMode="contain"
            />
          );
        },
      };
    }, [content, onCheckboxToggle, onLinkPress]);

    // ── Nội dung (dùng lại cho cả onPress và không onPress) ─────────────────

    const body = (
      <View style={{ paddingHorizontal, paddingBottom: 40 }}>
        {/* Media preview */}
        {mediaUrl && mediaType === "image" && (
          <Image
            source={{ uri: mediaUrl }}
            style={ms.mediaBanner}
            resizeMode="cover"
          />
        )}
        {mediaUrl && (mediaType === "voice" || mediaType === "video") && (
          <View style={ms.audioChip}>
            <Ionicons
              name={mediaType === "voice" ? "mic" : "videocam"}
              size={16}
              color={COLORS.accent}
            />
            <Text style={ms.audioLabel}>
              {mediaType === "voice" ? "Ghi âm đính kèm" : "Video đính kèm"}
            </Text>
            <Ionicons
              name="play-circle-outline"
              size={20}
              color={COLORS.accent}
            />
          </View>
        )}

        {/* AI Extracted panel */}
        {extractedInfo && (
          <View style={ms.exCard}>
            <Text style={ms.exTitle}>🤖 Thông tin AI trích xuất</Text>
            {extractedInfo.person_name && (
              <ExRow icon="👤" value={extractedInfo.person_name} />
            )}
            {extractedInfo.phone && (
              <ExRow icon="📞" value={extractedInfo.phone} />
            )}
            {extractedInfo.email && (
              <ExRow icon="✉️" value={extractedInfo.email} />
            )}
            {extractedInfo.organization && (
              <ExRow icon="🏢" value={extractedInfo.organization} />
            )}
            {extractedInfo.place_name && (
              <ExRow icon="📍" value={extractedInfo.place_name} />
            )}
            {extractedInfo.address && (
              <ExRow icon="🗺️" value={extractedInfo.address} />
            )}
            {extractedInfo.event_title && (
              <ExRow
                icon="📅"
                value={
                  extractedInfo.event_title +
                  (extractedInfo.event_time
                    ? `  ·  ${fmtDateTime(extractedInfo.event_time)}`
                    : "")
                }
              />
            )}
            {extractedInfo.deadline && (
              <ExRow
                icon="⏰"
                value={`Deadline: ${fmtDateTime(extractedInfo.deadline)}`}
              />
            )}
            {parseActionItems(extractedInfo.action_items).map((item, i) => (
              <ExRow key={i} icon="✅" value={item} />
            ))}
            {extractedInfo.category && extractedInfo.category !== "note" && (
              <View style={ms.catChip}>
                <Text style={ms.catText}>{extractedInfo.category}</Text>
              </View>
            )}
          </View>
        )}

        {/* Title */}
        {title !== undefined && (
          <Text style={[ms.title, !title && ms.titleMuted]}>
            {title || "Tiêu đề"}
          </Text>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <View style={ms.tagsRow}>
            {tags.map((t) => (
              <TagPill key={t} label={t} />
            ))}
          </View>
        )}

        {/* Divider */}
        {(title !== undefined || (tags && tags.length > 0)) && (
          <View style={ms.hairline} />
        )}

        {/* Markdown content */}
        <Markdown style={mdStyles} rules={rules} mergeStyle>
          {content || "_Nhấn để bắt đầu viết..._"}
        </Markdown>

        {/* Word count footer */}
        {showWordCount && wordStats && wordStats.words > 0 && (
          <View style={ms.footer}>
            <Text style={ms.footerText}>
              {wordStats.words} từ · ~{wordStats.minutes} phút đọc
            </Text>
          </View>
        )}
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity activeOpacity={1} onPress={onPress}>
          {body}
        </TouchableOpacity>
      );
    }

    return body;
  },
);

MarkdownViewer.displayName = "MarkdownViewer";

// ── Styles ───────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  mediaBanner: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },
  audioChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  audioLabel: { flex: 1, fontSize: 13, color: COLORS.textMuted },

  exCard: {
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  exTitle: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: "700",
    marginBottom: 10,
  },
  catChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: COLORS.active,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  catText: { fontSize: 11, color: COLORS.accent, fontWeight: "600" },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  titleMuted: { color: COLORS.textDim },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },

  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    alignItems: "center",
  },
  footerText: { fontSize: 12, color: COLORS.textDim },
});

export default MarkdownViewer;
