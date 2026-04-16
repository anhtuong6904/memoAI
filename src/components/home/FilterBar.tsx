import { COLORS } from "@/src/constants/colors";
import { FILTER_TYPES, FilterKey } from "@/src/types";
import { FlatList, TouchableOpacity, Text, StyleSheet, View } from "react-native";



interface FilterBarProps {
  filter: FilterKey;
  onChange: (key: FilterKey) => void;
}

export default function FilterBar({ filter, onChange }: FilterBarProps) {
  return (
    <View style = {styles.container}>
        <FlatList
        data={FILTER_TYPES}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        keyExtractor={i => i.key}
        renderItem={({ item }) => {
            const active = filter === item.key;

            return (
            <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange(item.key)}
            >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
                </Text>
            </TouchableOpacity>
            );
        }}
        />
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.background,
    },
    /* filter */
    filterBar: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    chipActive: {
        backgroundColor: COLORS.active,
        borderColor: COLORS.accent,
    },
    chipText: {
        fontSize: 13,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    chipTextActive: {
        color: COLORS.text,
    },
})