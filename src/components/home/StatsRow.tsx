import { COLORS } from "@/src/constants/colors";
import { Note } from "@/src/types";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, Text } from "react-native";

/* ── Stats component ── */
export default function StatsRow({ notes }: { notes: Note[] }) {
  const counts = notes.reduce(
    (acc, n) => { acc[n.type] = (acc[n.type] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const stats = [
    { icon: 'document-text-outline' as const, label: 'Ghi chú', count: counts.text  ?? 0, color: '#6C63FF' },
    { icon: 'image-outline'          as const, label: 'Ảnh',     count: counts.image ?? 0, color: '#3B82F6' },
    { icon: 'mic-outline'            as const, label: 'Audio',   count: counts.voice ?? 0, color: '#10B981' },
    { icon: 'videocam-outline'       as const, label: 'Video',   count: counts.video ?? 0, color: '#F59E0B' },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map(s => (
        <View key={s.label} style={styles.statCard}>
          <Ionicons name={s.icon} size={18} color={s.color} />
          <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
    /* stats */
    statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    },
    statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    },
    statCount: {
    fontSize: 16,
    fontWeight: '800',
    },
    statLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    fontWeight: '500',
    },
})