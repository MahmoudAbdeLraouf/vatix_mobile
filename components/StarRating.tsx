import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/theme'

// Mirrors vatix_website/components/star-rating.tsx.
// Supports half stars for display; interactive mode is whole-star only.

interface Props {
  value: number
  max?: number
  interactive?: boolean
  size?: number
  onChange?: (v: number) => void
}

export function StarRating({ value, max = 5, interactive = false, size = 16, onChange }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        const full = value >= n
        const half = !full && value >= n - 0.5
        const glyph = full ? '★' : half ? '★' : '☆'
        const color = full || half ? colors.y : colors.g300

        const star = (
          <Text
            style={{
              fontSize: size,
              lineHeight: size + 2,
              color,
              marginEnd: 2,
            }}
          >
            {glyph}
          </Text>
        )

        if (!interactive) {
          return <View key={i}>{star}</View>
        }
        return (
          <Pressable
            key={i}
            onPress={() => onChange?.(n)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
          >
            {star}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
