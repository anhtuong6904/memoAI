import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../constants/colors";
import { fmtDur } from "../../utils/format";

interface Props {
  name: string;
  currentTime: number;
  duration: number | null;
  playing: boolean;
  onPlayPause: () => void;
  onClose: () => void;
}

export function AudioPlayerBar({
  name,
  currentTime,
  duration,
  playing,
  onPlayPause,
  onClose,
}: Props) {
  const progress =
    duration && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <View style={s.audioBar}>
      <View style={s.audioBarRow}>
        <Ionicons
          name="musical-notes"
          size={13}
          color={COLORS.accent}
          style={{ flexShrink: 0 }}
        />
        <Text style={s.audioBarName} numberOfLines={1}>{name}</Text>
        <Text style={s.audioBarTime}>
          {fmtDur(Math.floor(currentTime))}
          {duration ? ` / ${fmtDur(Math.floor(duration))}` : ""}
        </Text>
        <TouchableOpacity
          onPress={onPlayPause}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={playing ? "pause-circle" : "play-circle"}
            size={32}
            color={COLORS.accent}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={22} color={COLORS.textDim} />
        </TouchableOpacity>
      </View>
      <View style={s.audioTrack}>
        <View style={[s.audioFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  audioBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  audioBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  audioBarName: { flex: 1, fontSize: 12, color: COLORS.text, fontWeight: "500" },
  audioBarTime: { fontSize: 11, color: COLORS.textDim },
  audioTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  audioFill: { height: 3, backgroundColor: COLORS.accent, borderRadius: 2 },
});
