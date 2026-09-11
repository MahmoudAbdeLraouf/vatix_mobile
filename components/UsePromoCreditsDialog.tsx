import { useState } from 'react'
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
import { markActionDismissed, markActionSeen } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { PROMOTION_UI_ENABLED } from '@/lib/platform'

interface Props {
  visible: boolean
  onClose: () => void
  credits: number
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

export function UsePromoCreditsDialog({ visible, onClose, credits }: Props) {
  const { t } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)

  function handleDismiss() {
    if (busy) return
    setBusy(true)
    markActionDismissed('use_promo_credits_dialog')
    onClose()
  }

  function handleGo() {
    if (busy) return
    setBusy(true)
    markActionSeen('use_promo_credits_dialog')
    onClose()
    router.push('/dashboard/promote')
  }

  if (!PROMOTION_UI_ENABLED) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text style={[styles.sheetTitle, dirStyle]} numberOfLines={1}>
              {t.usePromoCreditsDialog.title}
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
              <View style={styles.iconCircle}>
                <Text style={styles.iconEmoji}>🚀</Text>
              </View>

              <View style={styles.creditsBox}>
                <Text style={styles.creditsNumber}>{credits}</Text>
                <Text style={[styles.creditsLabel, dirStyle]}>
                  {t.usePromoCreditsDialog.creditsLabel}
                </Text>
              </View>

              <Text style={[styles.description, dirStyle]}>
                {t.usePromoCreditsDialog.body}
              </Text>

              <View style={[styles.actionsRow, rowDir]}>
                <View style={styles.actionCell}>
                  <Button
                    label={t.usePromoCreditsDialog.dismiss}
                    variant="outline"
                    size="lg"
                    onPress={handleDismiss}
                    disabled={busy}
                  />
                </View>
                <View style={styles.actionCell}>
                  <Button
                    label={t.usePromoCreditsDialog.cta}
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
  iconEmoji: {
    fontSize: 34,
    lineHeight: 40,
  },
  creditsBox: {
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.y,
    backgroundColor: colors.yl,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minWidth: 160,
  },
  creditsNumber: {
    fontFamily: fonts.black,
    fontSize: 36,
    lineHeight: 42,
    color: colors.dk,
  },
  creditsLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.g700,
    marginTop: 4,
    textAlign: 'center',
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
