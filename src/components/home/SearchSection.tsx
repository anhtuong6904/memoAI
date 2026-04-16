import React from 'react';
import { StyleSheet, View } from 'react-native';
import SearchBar from '../SearchBar';
import { HomeSearchSection } from '@/src/types';

export default function SearchSection({value, onChange}: HomeSearchSection ){
    return(
        
        <View style={styles.searchWrapper}>
            <SearchBar
            value={value}
            onChangeText={onChange}
            placeholder="Tìm kiếm ghi chú..."
            />
        </View>
    );
}

const styles = StyleSheet.create({
     /* search */
  searchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
})

      