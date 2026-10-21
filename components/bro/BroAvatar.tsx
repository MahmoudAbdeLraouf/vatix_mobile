import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fonts } from '@/constants/theme'

// Yellow "VB" mark on navy: the Vatix Bro identity in chat headers, lists and bubbles.
// Flat navy fill (no gradient) so we do not add a native dependency.
export function BroAvatar({ size = 40, radius }: { size?: number; radius?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3) },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.extraBold,
          color: colors.y,
          fontSize: Math.round(size * 0.4),
          lineHeight: Math.round(size * 0.5),
          letterSpacing: -size * 0.008,
          includeFontPadding: false,
        }}
      >
        VB
      </Text>
    </View>
  )
}

export function BroBadge({ label }: { label: string }) {
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
    backgroundColor: '#1A2540',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    // "VB" is Latin: keep it LTR regardless of the locale.
    direction: 'ltr',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.dk,
  },
})
