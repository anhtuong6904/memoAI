import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";
import { ErrorProps } from "../types";

export default function ErrorScreen({value, onReload} :ErrorProps ){
    return(
        
        <View style={styles.centerState}>
        <Ionicons name="cloud-offline-outline" size={52} color={COLORS.textDim} />
        <Text style={styles.errorTitle}>Không kết nối được server</Text>
        <Text style={styles.errorSub}>{value}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onReload}>
            <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
        </View>
        
    );
}

const styles = StyleSheet.create({
    /* error / empty states */
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
})