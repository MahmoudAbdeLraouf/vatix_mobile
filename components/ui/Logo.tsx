import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { colors, fonts } from '@/constants/theme'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  light?: boolean
}

const sizes = {
  sm: { icon: 28, text: 18 },
  md: { icon: 36, text: 24 },
  lg: { icon: 48, text: 32 },
}

export function Logo({ size = 'md', light = false }: LogoProps) {
  const s = sizes[size]
  return (
    <View style={styles.row}>
      <Image
        source={require('@/assets/logo.png')}
        style={[styles.icon, { width: s.icon, height: s.icon }]}
        resizeMode="contain"
      />
      <Text
        style={[styles.text, { fontSize: s.text, color: light ? colors.white : colors.dk }]}
        numberOfLines={1}
      >
        Vatix
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexWrap: 'nowrap',
  },
  icon: {
    marginEnd: 8,
    flexShrink: 0,
  },
  text: {
    fontFamily: fonts.black,
    letterSpacing: -0.5,
    flexShrink: 0,
  },
})
