import React, { forwardRef } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, spacing } from '@/constants/theme'

const OTP_LENGTH = 6

// Pulls the code out of whatever was pasted ("123456", "123 456", "Your code is 123456").
function extractCode(raw: string): string {
  const run = raw.match(new RegExp(`\\d{${OTP_LENGTH}}`))
  return (run ? run[0] : raw.replace(/\D/g, '')).slice(0, OTP_LENGTH)
}

interface Props {
  value: string
  onChange: (code: string) => void
  autoFocus?: boolean
}

export const OtpCodeInput = forwardRef<TextInput, Props>(function OtpCodeInput(
  { value, onChange, autoFocus = true },
  ref,
) {
  const { t } = useLocale()

  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => '')
    const code = extractCode(text)
    if (code) onChange(code)
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={ref}
        value={value}
        // No maxLength: it would truncate a pasted "123 456" before we can clean it.
        onChangeText={v => onChange(extractCode(v))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        placeholder="------"
        placeholderTextColor={colors.g400}
        style={styles.input}
        autoFocus={autoFocus}
      />
      <Pressable style={styles.pasteBtn} onPress={paste} hitSlop={8}>
        <Ionicons name="clipboard-outline" size={16} color={colors.g700} />
        <Text style={styles.pasteText}>{t.pasteCode}</Text>
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  input: {
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.g100,
    textAlign: 'center',
    writingDirection: 'ltr',
    fontFamily: fonts.black,
    fontSize: 32,
    letterSpacing: 8,
    color: colors.dk,
    paddingVertical: 0,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  pasteText: { fontFamily: fonts.bold, fontSize: 13, color: colors.g700 },
})
