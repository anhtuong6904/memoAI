import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {COLORS} from '@/src/constants/colors'
import {CaptureHeaderProps } from '@/src/types/index'


export default function CaptureHeader({title, subtitle}: CaptureHeaderProps){
    return (
        <View style = {styles.container}>
            <Text style = {styles.title}>{title}</Text>
            {subtitle ? <Text style = {styles.subtitle}>{subtitle}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container:{ 
        paddingTop: 8,
        paddingBottom: 12,
    },
    title:{
        fontSize:27,
        fontWeight: '700',
        color: COLORS.text,
    },
    subtitle:{
        marginTop: 4,
        fontSize: 13,
        color: COLORS.textMuted,
    }
})