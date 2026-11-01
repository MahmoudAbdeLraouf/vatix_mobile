import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { apiFetch } from '@/lib/api'
import { fonts, radius, spacing } from '@/constants/theme'

// Guests in the `guest_signup` treatment group get one sign-up nudge per app
// launch. Backend decides eligibility (holdout, quiet hours, already shown);
// we only render what it returns. Every network failure is silent.

interface GuestNudge {
  id: number
  categoryName: string | null
}

const NAVY = '#1A2540'
const YELLOW = '#F5B800'

// Module-level state = once per launch. Remounting the home tab reuses it.
let fetched = false
let cachedNudge: GuestNudge | null = null
let inflight: Promise<GuestNudge | null> | null = null
let dismissed = false
const seenIds = new Set<number>()

function loadNudge(): Promise<GuestNudge | null> {
  if (fetched) return Promise.resolve(cachedNudge)
  if (inflight) return inflight
  inflight = apiFetch<{ nudge: GuestNudge | null }>('/user-actions/public/guest-nudge')
    .then((res) => {
      const n = res?.nudge
      cachedNudge = n && typeof n.id === 'number' ? n : null
    })
    .catch(() => {
      cachedNudge = null
    })
    .then(() => {
      fetched = true
      inflight = null
      return cachedNudge
    })
  return inflight
}

function post(path: string, id: number) {
  apiFetch(path, { method: 'POST', body: JSON.stringify({ id }) }).catch(() => {})
}

export function GuestNudgeBanner() {
  const { isAuthenticated } = useAuth()
  const { t, locale, isRtl } = useLocale()
  const [nudge, setNudge] = useState<GuestNudge | null>(null)
  const [hidden, setHidden] = useState(dismissed)

  useEffect(() => {
    if (isAuthenticated || dismissed) return
    let alive = true
    loadNudge().then((n) => {
      if (alive && n) setNudge(n)
    })
    return () => {
      alive = false
    }
  }, [isAuthenticated])

  const visible = !!nudge && !hidden && !dismissed && !isAuthenticated
  const nudgeId = nudge?.id

  useEffect(() => {
    if (!visible || nudgeId == null || seenIds.has(nudgeId)) return
    seenIds.add(nudgeId)
    post('/user-actions/public/guest-nudge/seen', nudgeId)
  }, [visible, nudgeId])

  const onDismiss = useCallback(() => {
    dismissed = true
    setHidden(true)
    if (nudgeId != null) post('/user-actions/public/guest-nudge/dismiss', nudgeId)
  }, [nudgeId])

  const onSignUp = useCallback(() => {
    // register.tsx reads its post-auth return path from the `redirect` param.
    router.push({ pathname: '/(auth)/register', params: { redirect: '/(tabs)/home' } })
  }, [])

  if (!visible || !nudge) return null

  const category = locale === 'ar' ? nudge.categoryName?.trim() : null
  const title = category
    ? t.guestNudgeTitleCategory.replace('{category}', () => category)
    : t.guestNudgeTitle
  const dir = { direction: isRtl ? ('rtl' as const) : ('ltr' as const) }

  return (
    <View style={[styles.wrap, dir]}>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.close}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t.guestNudgeClose}
        >
          <Ionicons name="close" size={18} color={NAVY} />
        </TouchableOpacity>
        <Text style={[styles.title, { textAlign: isRtl ? 'right' : 'left' }]}>{title}</Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={onSignUp}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{t.guestNudgeCta}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  card: {
    backgroundColor: '#FFF9E6',
    borderColor: YELLOW,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    // Leave room for the close button pinned to the end corner.
    paddingEnd: spacing.xl + spacing.sm,
    gap: spacing.sm,
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: NAVY,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 22,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: YELLOW,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ctaText: {
    color: NAVY,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
})
