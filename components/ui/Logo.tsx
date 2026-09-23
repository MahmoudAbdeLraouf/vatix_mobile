import React from 'react'
import { Image, StyleSheet, View } from 'react-native'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  light?: boolean
}

const heights = {
  sm: 26,
  md: 34,
  lg: 44,
}

export function Logo({ size = 'md' }: LogoProps) {
  const h = heights[size]
  return (
    <View style={styles.row}>
      <Image
        source={require('@/assets/logo_img.png')}
        style={{ height: h, width: h * 3 }}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
})
