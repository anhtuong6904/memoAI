import React from "react";
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {COLORS} from "@/src/constants/colors"
import {CaptureDateTimeRowProps} from "@/src/types/index"

function Slot({label, value, onPress} : {label: string, value:string, onPress:() => void}){
    return(
        <TouchableOpacity
            style = {styles.slot}
            onPress = {onPress} 
            activeOpacity={0.8}
        >
            <Text style = {styles.slotLabel}>{label}</Text>
            <Text style = {styles.slotValue}>{value}</Text>
        </TouchableOpacity>
    )
}

export default function CaptureDateTimeRow({
    dateLabel,
    startLabel,
    endLabel,
    onPickDate,
    onPickStart,
    onPickEnd
}: CaptureDateTimeRowProps){
    return(
        <View style = {styles.wrapper}>
            <Slot label = "Date" value = {dateLabel} onPress={onPickDate}/>
            <View style={styles.timeRow}>
                <Slot label = "Start" value = {startLabel} onPress={onPickStart}/>
                <Slot label = "End" value = {endLabel} onPress={onPickEnd}/>
            </View>
        </View>
    )
}



const styles = StyleSheet.create({
    wrapper: {
        gap: 10,
    },
    timeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    slot: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#101522',
    },
    slotLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    slotValue: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
    },
})