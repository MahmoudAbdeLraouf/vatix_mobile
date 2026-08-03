import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useLocale } from '@/contexts/locale'
import { authPost, logShare } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

interface Props {
  visible: boolean
  storeId: number
  storeSlug: string | null
  storeName: string
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

const SHARE_DOMAIN = 'https://vatix.store'

function buildStoreUrl(storeId: number, storeSlug: string | null): string {
  return `${SHARE_DOMAIN}/stores/${storeSlug ?? storeId}`
}

export function StoreShareDialog({ visible, storeId, storeSlug, storeName, onClose }: Props) {
  const { t } = useLocale()
  const { ar, rowDir, dirStyle } = useDir()
  const insets = useSafeAreaInsets()
  const url = buildStoreUrl(storeId, storeSlug)

  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      logShare('store', storeId, 'clipboard')
    } catch {
      /* ignore */
    }
  }

  async function handleShare() {
    try {
      const message = `${t.storeShareText(storeName)}\n${url}`
      const result = await Share.share(
        Platform.OS === 'ios'
          ? { url, message: t.storeShareText(storeName) }
          : { message },
        { dialogTitle: storeName }
      )
      if (result.action === Share.sharedAction) {
        setShared(true)
        setTimeout(() => setShared(false), 2500)
        logShare('store', storeId, 'native')
      }
    } catch {
      handleCopy()
    }
  }

  function handleDismiss() {
    // Fire-and-forget — we don't want to block the UI if the request is slow.
    authPost('/user/profile/store-share-dialog/seen', {}).catch(() => {})
    onClose()
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
              {ar ? '🎉 ' : '🎉 '}
              {t.storeShareTitle}
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
              <Text style={[styles.description, dirStyle]}>{t.storeShareDescription}</Text>

              <View>
                <Text style={[styles.urlLabel, dirStyle]}>{t.storeShareUrlLabel}</Text>
                <View style={styles.urlBox}>
                  <Text style={styles.urlText} selectable numberOfLines={2}>
                    {url}
                  </Text>
                </View>
              </View>

              <View style={[styles.actionsRow, rowDir]}>
                <View style={styles.actionCell}>
                  <Button
                    label={copied ? `✓ ${t.storeShareCopied}` : `📋 ${t.storeShareCopy}`}
                    variant={copied ? 'dk' : 'dk'}
                    size="md"
                    onPress={handleCopy}
                    style={copied ? styles.copiedBtn : undefined}
                  />
                </View>
                <View style={styles.actionCell}>
                  <Button
                    label={shared ? `✓ ${t.storeShareShare}` : `🔗 ${t.storeShareShare}`}
                    variant="y"
                    size="md"
                    onPress={handleShare}
                  />
                </View>
              </View>

              <View style={styles.footer}>
                <Button
                  label={`${t.storeShareGotIt} 👍`}
                  variant="y"
                  size="lg"
                  onPress={handleDismiss}
                />
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
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g700,
    lineHeight: 22,
  },
  urlLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.g600,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlBox: {
    borderWidth: 2,
    borderColor: colors.y,
    backgroundColor: colors.yl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  urlText: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    fontSize: 15,
    fontWeight: '700',
    color: colors.dk,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCell: {
    flex: 1,
  },
  copiedBtn: {
    backgroundColor: colors.green,
  },
  footer: {
    marginTop: spacing.sm,
  },
})
