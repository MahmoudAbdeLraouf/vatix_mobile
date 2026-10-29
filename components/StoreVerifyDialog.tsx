import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { markActionDismissed } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface Props {
  visible: boolean
  onClose: () => void
}

function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const }) : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
  }
}

export function StoreVerifyDialog({ visible, onClose }: Props) {
  const { t } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  function handleDismiss() {
    if (busy) return
    setBusy(true)
    markActionDismissed('store_verify_dialog')
    onClose()
  }

  function handleGo() {
    if (busy) return
    setBusy(true)
    onClose()
    router.push('/dashboard/verify' as never)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text style={[styles.sheetTitle, dirStyle]} numberOfLines={1}>
              {t.storeVerifyDialog.title}
            </Text>
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior="padding"
            enabled={Platform.OS === 'ios'}
            keyboardVerticalOffset={20}
          >
            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.badge, rowDir]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.badgeText}>{t.storeVerifyDialog.badge}</Text>
              </View>

              <Text style={[styles.description, dirStyle]}>
                {t.storeVerifyDialog.body}
              </Text>

              <View style={[styles.actionsRow, rowDir]}>
                <View style={styles.actionCell}>
                  <Button
                    label={t.storeVerifyDialog.dismiss}
                    variant="outline"
                    size="lg"
                    onPress={handleDismiss}
                    disabled={busy}
                  />
                </View>
                <View style={styles.actionCell}>
                  <Button
                    label={t.storeVerifyDialog.cta}
                    variant="y"
                    size="lg"
                    onPress={handleGo}
                    disabled={busy}
                  />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
    ...(dark ? null : shadow.sl),
  },
  sheetHeader: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
    marginEnd: spacing.md,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A2540',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: '#FFFFFF',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  actionCell: {
    flex: 1,
  },
})
