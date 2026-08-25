import { useEffect, useRef, useState } from 'react'
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as StoreReview from 'expo-store-review'
import { useLocale } from '@/contexts/locale'
import { markActionDismissed, markActionSeen } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
}

const AUTO_HIDE_MS = 2 * 60 * 1000

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

export function RateAppDialog({ visible, onClose }: Props) {
  const { t } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) return
    autoHideRef.current = setTimeout(() => {
      markActionDismissed('rate_app_dialog')
      onClose()
    }, AUTO_HIDE_MS)
    return () => {
      if (autoHideRef.current) {
        clearTimeout(autoHideRef.current)
        autoHideRef.current = null
      }
    }
  }, [visible, onClose])

  function clearAutoHide() {
    if (autoHideRef.current) {
      clearTimeout(autoHideRef.current)
      autoHideRef.current = null
    }
  }

  function handleDismiss() {
    if (busy) return
    setBusy(true)
    clearAutoHide()
    markActionDismissed('rate_app_dialog')
    onClose()
  }

  async function handleFeedback() {
    if (busy) return
    setBusy(true)
    clearAutoHide()
    markActionDismissed('rate_app_dialog')
    onClose()
    router.push('/contact')
  }

  async function handleRate() {
    if (busy) return
    setBusy(true)
    clearAutoHide()
    markActionSeen('rate_app_dialog')
    onClose()
    // Prefer opening the configured store URL — the native in-app review sheet
    // silently no-ops in dev/internal-track builds and past quota, leaving the
    // user with no visible feedback.
    try {
      const url = StoreReview.storeUrl()
      if (url) {
        await Linking.openURL(url)
        return
      }
      const canReview =
        (await StoreReview.hasAction()) && (await StoreReview.isAvailableAsync())
      if (canReview) {
        await StoreReview.requestReview()
      }
    } catch {
      // Silent — user already committed by tapping
    }
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
              {t.rateApp.title}
            </Text>
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.iconCircle}>
              <Ionicons name="star" size={36} color={colors.dk} />
            </View>

            <Text style={[styles.description, dirStyle]}>{t.rateApp.body}</Text>

            <View style={[styles.actionsRow, rowDir]}>
              <View style={styles.actionCell}>
                <Button
                  label={t.rateApp.negativeCta}
                  variant="outline"
                  size="lg"
                  onPress={handleFeedback}
                  disabled={busy}
                />
              </View>
              <View style={styles.actionCell}>
                <Button
                  label={t.rateApp.positiveCta}
                  variant="y"
                  size="lg"
                  onPress={handleRate}
                  disabled={busy}
                />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
    ...shadow.sl,
  },
  sheetHeader: {
    backgroundColor: colors.dk,
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
  iconCircle: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g700,
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
