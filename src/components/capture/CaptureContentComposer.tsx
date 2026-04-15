import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView 
} from 'react-native';
import {COLORS} from '@/src/constants/colors';
import {CaptureContentComposerProps, MarkdownTemplate} from '@/src/types/index';

//markdown h1, h2, h3, bullet, numbered, quote, code,.... 

const MARKDOWN_TEMPLATES : MarkdownTemplate[] = [
    {key: 'h1', label: 'H1', snippet:'# '},
    {key: 'h2', label: 'H2', snippet:'## '},
    {key: 'h3', label: 'H3', snippet:'### '},
    {key: 'bullet', label: '• List', snippet:'- '},
    {key: 'numbered', label: '1. List', snippet:'1. '},
    {key: 'quote', label: 'Quote', snippet:'> '},
    {key: 'code', label: 'Code', snippet:'```\n\n```'},
]

function insertSnippet (content: string, snippet: string) {
    if(!content.trim()) return snippet;
    const shouldBreakLine = content.endsWith('\n');
    return `${content}${shouldBreakLine ? '' : '\n'}${snippet}`;
}

export default function CaptureContentComposer({value, onChangeText}: CaptureContentComposerProps){
    const handleInsert = (snippet : string) => {
        onChangeText(insertSnippet(value, snippet));
    }
    return(
        <View>
            <Text></Text>
            <ScrollView 
                horizontal
                showsHorizontalScrollIndicator = {false}
                contentContainerStyle = {styles.toolbar}
            >
                {MARKDOWN_TEMPLATES.map((item) => (
                    <TouchableOpacity
                        key = {item.key}
                        style = {styles.toolButton}
                        activeOpacity={0.85}
                        onPress={() => handleInsert(item.snippet)}
                    >
                        <Text style = {styles.toolText}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <TextInput 
                style = {styles.editor}
                placeholder='Viết nội dung..'
                placeholderTextColor={COLORS.textMuted}
                value={value}
                onChangeText={onChangeText}
                multiline
                numberOfLines={10}
                textAlignVertical='top'
            />
        </View>
    );
}

const styles = StyleSheet.create({
    label: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    toolbar: {
        gap: 8,
        paddingBottom: 10,
    },
    toolButton: {
        borderRadius: 9,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: '#101522',
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    toolText: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: '600',
    },
    editor: {
        minHeight: 170,
        fontSize: 15,
        lineHeight: 21,
        color: COLORS.text,
        backgroundColor: '#101522',
        borderRadius: 10,
        borderColor: COLORS.border,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    hint: {
        color: COLORS.textMuted,
        fontSize: 12,
        lineHeight: 18,
    },
})