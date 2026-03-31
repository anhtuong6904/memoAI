import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>Details</Text>
        <Text style={styles.sub}>Đang xây dựng...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon:      { fontSize: 52, marginBottom: 12 },
  title:     { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  sub:       { fontSize: 14, color: COLORS.textMuted, marginTop: 6 },
});