import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { colors, fonts, shadow } from '@/constants/theme'

// Mirrors website .btn-* classes in vatix_website/app/globals.css
// - y      → .btn-y      (yellow bg, navy text)
// - dk     → .btn-dk     (navy bg, white text)
// - outline→ .btn-out    (white bg, navy text, g300 border)
// - ghost  → translucent, for use over dark backgrounds
// - red    → .btn-red    (red-light bg, red text + border)
// - cta    → .btn-cta    (yellow with drop-shadow, extra bold)
// `primary` kept as alias for `y` for backward compat.
type Variant = 'y' | 'dk' | 'outline' | 'ghost' | 'red' | 'destructive' | 'cta' | 'primary'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  style?: ViewStyle
}

const SIZE_MAP: Record<Size, { paddingV: number; paddingH: number; radius: number; font: number; height: number }> = {
  sm: { paddingV: 6, paddingH: 13, radius: 7, font: 12, height: 34 },
  md: { paddingV: 10, paddingH: 20, radius: 9, font: 14, height: 44 },
  lg: { paddingV: 13, paddingH: 28, radius: 9, font: 15, height: 52 },
}

function resolveVariant(v: Variant): Exclude<Variant, 'primary' | 'destructive'> {
  if (v === 'primary') return 'y'
  if (v === 'destructive') return 'red'
  return v
}

export function Button({
  label,
  variant = 'y',
  size = 'lg',
  loading = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const v = resolveVariant(variant)
  const s = SIZE_MAP[size]

  const variantStyle = VARIANT_STYLES[v]
  const labelColor = VARIANT_LABEL_COLOR[v]

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderRadius: s.radius,
          minHeight: s.height,
        },
        variantStyle,
        v === 'cta' && shadow.ss,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconStart}>{leftIcon}</View> : null}
          <Text
            style={[
              styles.label,
              { color: labelColor, fontSize: s.font },
              v === 'cta' && styles.ctaLabel,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightIcon ? <View style={styles.iconEnd}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  )
}

const VARIANT_STYLES: Record<Exclude<Variant, 'primary' | 'destructive'>, ViewStyle> = {
  y: {
    backgroundColor: colors.y,
  },
  dk: {
    backgroundColor: colors.dk,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.g300,
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  red: {
    backgroundColor: colors.rl,
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  cta: {
    backgroundColor: colors.y,
  },
}

const VARIANT_LABEL_COLOR: Record<Exclude<Variant, 'primary' | 'destructive'>, string> = {
  y: colors.dk,
  dk: colors.white,
  outline: colors.dk,
  ghost: colors.white,
  red: colors.red,
  cta: colors.dk,
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStart: {
    marginEnd: 8,
  },
  iconEnd: {
    marginStart: 8,
  },
  label: {
    fontFamily: fonts.bold,
  },
  ctaLabel: {
    fontFamily: fonts.extraBold,
  },
})
