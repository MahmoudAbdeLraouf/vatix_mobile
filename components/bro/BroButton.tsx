import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius } from '@/constants/theme'

type Variant = 'outline' | 'dark' | 'yellow'
type Size = 'sm' | 'md'
export type BroIconName = React.ComponentProps<typeof Ionicons>['name']

/**
 * Bro action button.
 * - Button mode (default): outline = secondary, dark = primary, yellow = accent CTA. `size="md"` is the 44pt tap target.
 * - Chip mode (`chip`): rounded selectable pill; `selected` switches to the yellow-tint state.
 */
export function BroButton({
  label,
  onPress,
  disabled,
  variant = 'outline',
  selected,
  chip,
  size = 'sm',
  icon,
  fullWidth,
  dirStyle,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: Variant
  selected?: boolean
  chip?: boolean
  size?: Size
  icon?: BroIconName
  fullWidth?: boolean
  dirStyle?: object
}) {
  const dark = !chip && variant === 'dark'
  const yellow = !chip && variant === 'yellow'
  const on = !!chip && !!selected
  const fg = chip ? (on ? colors.dk : colors.g700) : dark ? colors.white : colors.dk
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: selected === undefined ? undefined : selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        chip ? styles.chip : size === 'md' ? styles.btnMd : styles.btnSm,
        chip ? (on ? styles.chipOn : styles.chipOff) : dark ? styles.btnDark : yellow ? styles.btnYellow : styles.btnOutline,
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.inner}>
        {icon ? <Ionicons name={icon} size={size === 'md' ? 18 : 15} color={on ? colors.yt : fg} /> : null}
        <Text
          style={[
            styles.label,
            size === 'md' && !chip && styles.labelMd,
            on && styles.labelOn,
            { color: fg },
            dirStyle,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSm: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm },
  btnMd: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md },
  chip: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  btnOutline: { backgroundColor: colors.white, borderColor: colors.g200 },
  btnDark: { backgroundColor: colors.dk, borderColor: colors.dk },
  btnYellow: { backgroundColor: colors.y, borderColor: colors.y },
  chipOff: { backgroundColor: colors.white, borderColor: colors.g200 },
  chipOn: { backgroundColor: colors.yl, borderColor: colors.y, borderWidth: 1.5 },
  fullWidth: { alignSelf: 'stretch' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.semiBold, fontSize: 13 },
  labelMd: { fontFamily: fonts.bold, fontSize: 14 },
  labelOn: { fontFamily: fonts.bold },
})
