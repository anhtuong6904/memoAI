import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {COLORS} from '@/src/constants/colors';
import {CaptureSectionCardProps} from '@/src/types';

export default function CaptureSectionCard({label, helper, children} : CaptureSectionCardProps){
    return (
        <View style = {styles.card}>
            <View style = {styles.cardHead}>
                <Text style = {styles.label}>{label}</Text>
                {helper ? <Text style = {styles.helper}>{helper}</Text> : null}
            </View>
            {children}
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
    },
    cardHead: {
        marginBottom: 8,
    },
    label: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '700',
    },
    helper: {
        marginTop: 3,
        color: COLORS.textMuted,
        fontSize: 12,
    },
})