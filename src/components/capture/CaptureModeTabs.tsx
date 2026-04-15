import React, { ReactElement } from "react";
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {COLORS} from '@/src/constants/colors';
import {Icon} from '@/src/constants/Icon'
import {CaptureModeTabsProps, CaptureMode} from '@/src/types'

const MODE_OPTION: Array <{
    key:CaptureMode, 
    label: string; 
    icon: React.ReactElement; 
}> = [
    {key: 'note', label: 'Note', icon: <Icon name = 'note'/>},
    {key: 'task', label: 'Task', icon: <Icon name = 'task'/>},
    {key: 'meeting', label: 'Meeting', icon: <Icon name = 'meeting'/>}    
]

export default function CaptureModeTabs ({mode, onModeChange}: CaptureModeTabsProps){
    return(
        <View style = {styles.container}>
            {MODE_OPTION.map((item) => {
                const active = item.key === mode;
                return (
                    <TouchableOpacity
                        key={item.key}
                        style = {[styles.chip, active && styles.chipActive]}
                        onPress = { () => onModeChange(item.key)}
                        activeOpacity={0.85}
                    >
                        <Text style = {[styles.chipText, active && styles.chipTextActive]}>
                            {item.icon} {item.label}
                        </Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}



const styles = StyleSheet.create({
    container:{
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },

    chip:{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderBlockColor: COLORS.border,
        backgroundColor: COLORS.surface
    },
    chipActive:{
        borderColor: COLORS.accent,
        backgroundColor: COLORS.active
    },
    chipText:{
        color: COLORS.textMuted,
        fontSize: 13,
        fontWeight: 600,
    },
    chipTextActive:{
        color: COLORS.text,
    }
})