import React, { forwardRef, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'

type Props = {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onBlur?: () => void
}

/**
 * Text composer. Always editable: sending is optimistic, so the field is cleared at once and
 * a failed send is retried from its bubble rather than restored here. (No mic: voice notes
 * need a native module this OTA-shipped build does not have.)
 */
export const Composer = forwardRef<TextInput, Props>(function Composer({ value, onChangeText, onSend, onBlur }, ref) {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const empty = !value.trim()

  return (
    <View style={styles.bar}>
      <View style={styles.pill}>
        <TextInput
          ref={ref}
          style={[styles.input, dirStyle]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={t.typeMessage}
          placeholderTextColor={colors.subtle}
          multiline
          maxLength={2000}
        />
      </View>
      <Pressable
        style={({ pressed }) => [styles.sendBtn, empty && styles.sendBtnDisabled, pressed && !empty && styles.sendBtnPressed]}
        onPress={onSend}
        disabled={empty}
        accessibilityRole="button"
        accessibilityLabel={t.send}
      >
        <Ionicons
          name="send"
          size={20}
          color={empty ? colors.subtle : colors.dk}
          style={ar ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      </Pressable>
    </View>
  )
})

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.xs,
    },
    pill: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
      minHeight: 48,
      maxHeight: 140,
    },
    input: {
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
      paddingVertical: Platform.OS === 'ios' ? 13 : 9,
      padding: 0,
      margin: 0,
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.y,
      alignItems: 'center',
      justifyContent: 'center',
      ...(dark ? null : shadow.sm),
    },
    sendBtnDisabled: {
      backgroundColor: colors.placeholder,
      borderWidth: 1,
      borderColor: colors.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    sendBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.94 }],
    },
  })
