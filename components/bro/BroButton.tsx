import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, fonts, radius } from '@/constants/theme'

type Variant = 'outline' | 'dark'

/** Small pill button used by the Bro chat message and details form (outline = idle, dark = selected / primary). */
export function BroButton({
  label,
  onPress,
  disabled,
  variant = 'outline',
  selected,
  dirStyle,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: Variant
  selected?: boolean
  dirStyle?: object
}) {
  const dark = variant === 'dark'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: selected === undefined ? undefined : selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        dark ? styles.btnDark : styles.btnOutline,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, dark ? styles.labelDark : styles.labelOutline, dirStyle]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: { backgroundColor: colors.white, borderColor: colors.g200 },
  btnDark: { backgroundColor: colors.dk, borderColor: colors.dk },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.semiBold, fontSize: 13 },
  labelOutline: { color: colors.dk },
  labelDark: { color: colors.white },
})
