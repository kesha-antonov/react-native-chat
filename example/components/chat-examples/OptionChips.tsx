import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useColorScheme } from '@/hooks/use-color-scheme'

export interface OptionChip {
  id: string
  label: string
  isActive: boolean
}

/** The row of toggles the option-driven examples put above their chat, in both themes. */
export function OptionChips ({ title, options, onPress }: { title?: string, options: OptionChip[], onPress: (id: string) => void }) {
  const isDark = useColorScheme() === 'dark'

  return (
    <View style={[styles.toolbar, isDark && styles.toolbarDark]}>
      {title && <Text style={[styles.title, isDark && styles.textDark]}>{title}</Text>}
      {options.map(option => (
        <Pressable
          key={option.id}
          onPress={() => onPress(option.id)}
          style={[styles.chip, isDark && styles.chipDark, option.isActive && styles.chipActive]}
        >
          <Text style={[styles.chipText, isDark && styles.textDark, option.isActive && styles.chipTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  toolbarDark: {
    backgroundColor: '#242D39',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1D21',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EEF0F2',
  },
  chipDark: {
    backgroundColor: '#2F3B4A',
  },
  chipActive: {
    backgroundColor: '#229AF0',
  },
  chipText: {
    fontSize: 13,
    color: '#1A1D21',
  },
  textDark: {
    color: '#E9EEF4',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
