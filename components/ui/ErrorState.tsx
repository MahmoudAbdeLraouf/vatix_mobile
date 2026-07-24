import React from 'react'
import { StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, spacing } from '@/constants/theme'
import { Button } from './Button'
import { useLocale } from '@/contexts/locale'

type ErrorKind = 'network' | 'forbidden' | 'notFound' | 'generic'

interface ErrorStateProps {
  kind?: ErrorKind
  title?: string
  subtitle?: string
  retryLabel?: string
  onRetry?: () => void
  style?: ViewStyle | ViewStyle[]
}

const ICON_FOR: Record<ErrorKind, keyof typeof Ionicons.glyphMap> = {
  network: 'cloud-offline-outline',
  forbidden: 'lock-closed-outline',
  notFound: 'search-outline',
  generic: 'alert-circle-outline',
}

export function ErrorState({
  kind = 'generic',
  title,
  subtitle,
  retryLabel,
  onRetry,
  style,
}: ErrorStateProps) {
  const { t } = useLocale()

  const defaults: Record<ErrorKind, { title: string; subtitle: string }> = {
    network: { title: t.networkError, subtitle: t.errorRetryHint },
    forbidden: { title: t.forbiddenTitle, subtitle: t.forbiddenSubtitle },
    notFound: { title: t.noResults, subtitle: t.notFoundHint },
    generic: { title: t.error, subtitle: t.errorRetryHint },
  }

  const finalTitle = title ?? defaults[kind].title
  const finalSubtitle = subtitle ?? defaults[kind].subtitle
  const finalRetryLabel = retryLabel ?? t.retry

  return (
    <View style={[styles.wrap, style as ViewStyle]}>
      <View style={styles.icon}>
        <Ionicons name={ICON_FOR[kind]} size={28} color={colors.g500} />
      </View>
      <Text style={styles.title}>{finalTitle}</Text>
      {finalSubtitle ? <Text style={styles.subtitle}>{finalSubtitle}</Text> : null}
      {onRetry ? (
        <View style={styles.action}>
          <Button label={finalRetryLabel} onPress={onRetry} variant="outline" size="md" fullWidth={false} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.g900,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.md,
  },
})
