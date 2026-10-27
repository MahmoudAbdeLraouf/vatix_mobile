import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { colors, darkColors, fonts, lightColors, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const NAVY = colors.dk

// Yellow robot mark on navy: the Vatix Bro identity in chat headers, lists and bubbles.
// Drawn on a 64-unit grid; `radius` is in points and scaled onto that grid.
export function BroAvatar({ size = 40, radius }: { size?: number; radius?: number }) {
  const rx = ((radius ?? size * 0.3) / size) * 64
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.avatar}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect width={64} height={64} rx={rx} fill={NAVY} />
        <Path d="M32 20v-6" stroke={colors.y} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={32} cy={12} r={3.2} fill={colors.white} />
        <Rect x={9.5} y={29} width={4.5} height={10} rx={2.25} fill={colors.y} />
        <Rect x={50} y={29} width={4.5} height={10} rx={2.25} fill={colors.y} />
        <Rect x={14} y={20} width={36} height={28} rx={11} fill={colors.y} />
        <Rect x={20} y={27} width={24} height={11} rx={5.5} fill={NAVY} />
        <Circle cx={26.5} cy={32.5} r={2.4} fill={colors.y} />
        <Circle cx={37.5} cy={32.5} r={2.4} fill={colors.y} />
        <Path d="M27 42.5c3 1.8 7 1.8 10 0" fill="none" stroke={NAVY} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  )
}

// Single-colour robot for icon slots (tab bar): outline when idle, filled when focused, like Ionicons pairs.
export function BroGlyph({ size = 24, color, focused }: { size?: number; color: string; focused?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 7.5V4.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={3.4} r={1.5} fill={color} />
      <Rect x={1.6} y={11} width={2} height={4.6} rx={1} fill={color} />
      <Rect x={20.4} y={11} width={2} height={4.6} rx={1} fill={color} />
      <Rect
        x={4.6}
        y={7.6}
        width={14.8}
        height={12}
        rx={4.6}
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
      />
      <Circle cx={9.4} cy={12.8} r={1.45} fill={focused ? colors.white : color} />
      <Circle cx={14.6} cy={12.8} r={1.45} fill={focused ? colors.white : color} />
      <Path
        d="M9.8 16.3c1.3.8 3.1.8 4.4 0"
        fill="none"
        stroke={focused ? colors.white : color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function BroBadge({ label }: { label: string }) {
  const styles = themedStyles[useTheme().mode]
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    flexShrink: 0,
  },
})

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.yellowBg,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: dark ? colors.y : colors.dk,
  },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
