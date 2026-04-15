import React from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import {COLORS} from '@/src/constants/colors';
import {CaptureTitleInputProps} from '@/src/types';


export default function CaptureTitleInput ({value, onChangeText} : CaptureTitleInputProps){
    return (
        <TextInput
            style = {styles.input}
            placeholder="Tiêu đề.."
            placeholderTextColor={COLORS.textMuted}
            value={value}
            onChangeText={onChangeText}
            maxLength={120}
        />
    )
}

const styles = StyleSheet.create({
    input:{
        fontSize : 20,
        color: COLORS.text,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingBottom: 10,
        marginBottom: 12,
        fontWeight: 700,
    }
})

