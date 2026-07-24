import React, { forwardRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, spacing } from '@/constants/theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightIconPress?: () => void
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, leftIcon, rightIcon, onRightIconPress, style, multiline, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const { isRtl } = useLocale()
  const wrapperDir = isRtl ? { direction: 'rtl' as const } : null
  // Rely on the parent's `direction: rtl` to place flex-start on the right in
  // Arabic. Explicit flex-end would resolve to the visual LEFT under RTL and
  // push the label to the wrong side.
  const textRowStyle = {
    flexDirection: 'row' as const,
    width: '100%' as const,
  }
  const textStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: isRtl ? ('right' as const) : ('left' as const),
  }
  const inputDirStyle = textStyle

  return (
    <View style={[styles.wrapper, wrapperDir]}>
      {label && (
        <View style={[textRowStyle, styles.labelRow]}>
          <Text style={[styles.label, textStyle]}>{label}</Text>
        </View>
      )}
      <View
        style={[
          styles.container,
          multiline && styles.containerMultiline,
          focused && styles.focused,
          !!error && styles.errored,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            inputDirStyle,
            multiline && styles.inputMultiline,
            style,
          ]}
          placeholderTextColor={colors.g400}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : undefined}
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.icon} hitSlop={8}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {!!error && (
        <View style={[textRowStyle, styles.errorRow]}>
          <Text style={[styles.error, textStyle]}>{error}</Text>
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: spacing.md,
  },
  labelRow: {
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
  },
  errorRow: {
    marginTop: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  containerMultiline: {
    height: undefined,
    minHeight: 128,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  focused: {
    borderColor: colors.y,
  },
  errored: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g900,
  },
  inputMultiline: {
    minHeight: 112,
    paddingTop: 0,
    lineHeight: 22,
  },
  leftIcon: {
    marginEnd: spacing.sm,
  },
  icon: {
    marginStart: spacing.sm,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.error,
  },
})
