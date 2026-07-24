import { useMemo, useState } from 'react'
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Application from 'expo-application'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import type { SiteSettings } from '@/lib/api'

interface Props {
  settings: SiteSettings | null
}

type Mode = 'forced' | 'soft' | null

// Compare "1.2.3" style version strings. Returns -1/0/1 like localeCompare.
// Missing segments are treated as 0 ("1.2" < "1.2.1"). Non-numeric segments
// fall back to 0 so a malformed value never crashes the app on launch.
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0)
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? 0
    const bi = pb[i] ?? 0
    if (ai < bi) return -1
    if (ai > bi) return 1
  }
  return 0
}

function pickPlatform(settings: SiteSettings): {
  min: string | null
  latest: string | null
  storeUrl: string | null
} {
  if (Platform.OS === 'ios') {
    return {
      min: settings.iosMinVersion,
      latest: settings.iosLatestVersion,
      storeUrl: settings.iosStoreUrl,
    }
  }
  if (Platform.OS === 'android') {
    return {
      min: settings.androidMinVersion,
      latest: settings.androidLatestVersion,
      storeUrl: settings.androidStoreUrl,
    }
  }
  return { min: null, latest: null, storeUrl: null }
}

export function UpdatePrompt({ settings }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useLocale()
  const [dismissed, setDismissed] = useState(false)

  const mode: Mode = useMemo(() => {
    if (!settings) return null
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null

    const current = Application.nativeApplicationVersion
    if (!current) return null

    const { min, latest } = pickPlatform(settings)

    if (min && compareVersions(current, min) < 0) return 'forced'
    if (latest && compareVersions(current, latest) < 0) return 'soft'
    return null
  }, [settings])

  if (!mode) return null
  if (mode === 'soft' && dismissed) return null

  const { storeUrl } = settings ? pickPlatform(settings) : { storeUrl: null }
  const forced = mode === 'forced'

  const openStore = () => {
    if (storeUrl) Linking.openURL(storeUrl).catch(() => {})
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!forced) setDismissed(true)
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!forced) setDismissed(true)
        }}
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.iconWrap}>
            <Ionicons
              name={forced ? 'alert-circle' : 'cloud-download'}
              size={44}
              color={colors.dk}
            />
          </View>

          <Text style={styles.title}>
            {forced ? t.updateRequiredTitle : t.updateAvailableTitle}
          </Text>
          <Text style={styles.body}>
            {forced ? t.updateRequiredBody : t.updateAvailableBody}
          </Text>

          <View style={styles.actions}>
            <Button
              label={t.updateNow}
              variant="y"
              size="lg"
              onPress={openStore}
              disabled={!storeUrl}
            />
            {!forced ? (
              <Button
                label={t.updateLater}
                variant="outline"
                size="lg"
                onPress={() => setDismissed(true)}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    ...shadow.sl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.dk,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  actions: {
    width: '100%',
  },
})
