import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const OTP_LENGTH = 6

// Pulls the code out of whatever was pasted ("123456", "123 456", "Your code is 123456").
function extractCode(raw: string): string {
  const run = raw.match(new RegExp(`\\d{${OTP_LENGTH}}`))
  return (run ? run[0] : raw.replace(/\D/g, '')).slice(0, OTP_LENGTH)
}

interface Props {
  value: string
  onChange: (code: string) => void
  // Fired once the 6th digit lands (typing, paste, or keyboard suggestion).
  onComplete?: () => void
  autoFocus?: boolean
}

export const OtpCodeInput = forwardRef<TextInput, Props>(function OtpCodeInput(
  { value, onChange, onComplete, autoFocus = true },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const styles = themedStyles[useTheme().mode]

  // Read the latest handler after the parent re-renders with the new code,
  // so the screen's verify function sees the full value instead of a stale one.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const prevLength = useRef(value.length)
  useEffect(() => {
    if (value.length === OTP_LENGTH && prevLength.current < OTP_LENGTH) onCompleteRef.current?.()
    prevLength.current = value.length
  }, [value])

  const active = Math.min(value.length, OTP_LENGTH - 1)

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <View key={i} style={[styles.box, focused && i === active && styles.boxActive]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      {/* The real input sits invisibly over the boxes so taps, long-press paste
          and the keyboard's code suggestion all go straight to it. */}
      <TextInput
        ref={ref}
        value={value}
        // No maxLength: it would truncate a pasted "123 456" before we can clean it.
        onChangeText={v => onChange(extractCode(v))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        caretHidden
        selectionColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
        autoFocus={autoFocus}
      />
    </View>
  )
})

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  // Digits always read left-to-right, even in Arabic.
  row: { flexDirection: 'row', direction: 'ltr', gap: spacing.sm },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.dot,
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.y, backgroundColor: colors.inputBg },
  digit: { fontFamily: fonts.black, fontSize: 26, color: colors.heading },
  input: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 1,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
