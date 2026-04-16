import { COLORS } from "@/src/constants/colors"
import { HomeHeaderProps } from "@/src/types"
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, View, Text, TouchableOpacity } from "react-native"

export default function HomeHeader({ total, loading, onAddPress }: HomeHeaderProps) {
    return(
    <>
    {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>MemoAI</Text>
              <Text style={styles.headerSub}>
                {loading ? 'Đang tải...' : `${total} ghi chú`}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('HomeList')}   // navigate to Capture tab nếu cần
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
    </>
)};

const styles = StyleSheet.create({
     /* header */
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
      },
      headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.5,
      },
      headerSub: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 1,
      },
      headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      iconBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
      },
      addBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
      },
})