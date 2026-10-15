import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { DashboardLayout } from '@/components/DashboardLayout'
import { BottomTabBar } from '@/components/BottomTabBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ImportBackLink } from '@/components/import/ImportBackLink'
import { DefaultCategoryBrand } from '@/components/import/DefaultCategoryBrand'
import { ImportRowCard } from '@/components/import/ImportRowCard'
import { ImportErrors } from '@/components/import/ImportErrors'
import { useImportOptions } from '@/hooks/useImportOptions'
import { describeImportError, useImportConfirm } from '@/hooks/useImportConfirm'
import { useLocale } from '@/contexts/locale'
import {
  ImportApiError,
  MAX_IMPORT_IMAGES,
  confirmEasyOrders,
  connectEasyOrders,
  disconnectEasyOrders,
  flattenEasyOrdersErrors,
  getEasyOrdersPreview,
  getEasyOrdersStatus,
  type EasyOrdersPreviewError,
  type EasyOrdersRow,
} from '@/lib/import'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const GUIDE_IMAGE = require('@/assets/import-guides/easyorders-public-api.png')
const DASHBOARD_URL = 'https://my.easy-orders.net'

type ConnState = 'loading' | 'error' | 'disconnected' | 'connected'

// EasyOrders import — mirrors the website's EasyOrders tab
// (vatix_website/app/dashboard/products/import/page.tsx).
export default function EasyOrdersImportScreen() {
  const { t, locale } = useLocale()
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    // Pin the Text's own direction so 'right' isn't double-flipped by the inherited RTL root.
    direction: 'ltr' as const,
  }
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  const { categoryOptions, brandOptions } = useImportOptions()
  const confirm = useImportConfirm()

  const [conn, setConn] = useState<ConnState>('loading')
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [reconnectRequired, setReconnectRequired] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const [defaultCategory, setDefaultCategory] = useState('')
  const [defaultBrand, setDefaultBrand] = useState('')

  const [rows, setRows] = useState<EasyOrdersRow[] | null>(null)
  const [previewErrors, setPreviewErrors] = useState<EasyOrdersPreviewError[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setConn('loading')
    try {
      const status = await getEasyOrdersStatus()
      setConnectedAt(status.connectedAt ?? null)
      setConn(status.connected ? 'connected' : 'disconnected')
    } catch {
      setConn('error')
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const resetPreview = () => {
    setRows(null)
    setPreviewErrors([])
    setHasMore(false)
    setPage(1)
    setPreviewError(null)
    confirm.setError(null)
  }

  const onConnect = async () => {
    const key = apiKey.trim()
    if (!key) {
      setConnectError(ip.eoApiKeyRequired)
      return
    }
    setConnecting(true)
    setConnectError(null)
    try {
      await connectEasyOrders(key)
      setApiKey('')
      setReconnectRequired(false)
      await loadStatus()
    } catch (err) {
      if (err instanceof ImportApiError && err.code === 'EASYORDERS_INVALID_KEY') {
        setConnectError(ip.eoInvalidKey)
      } else if (err instanceof ImportApiError && err.code === 'EASYORDERS_MISSING_PERMISSION') {
        setConnectError(ip.eoMissingPermission)
      } else {
        setConnectError(describeImportError(err, t, ip.eoInvalidKey))
      }
    } finally {
      setConnecting(false)
    }
  }

  const onDisconnect = () => {
    Alert.alert(ip.disconnectConfirmTitle, ip.disconnectConfirmBody, [
      { text: ip.cancel, style: 'cancel' },
      {
        text: ip.disconnect,
        style: 'destructive',
        onPress: async () => {
          setDisconnecting(true)
          try {
            await disconnectEasyOrders()
            resetPreview()
            setDefaultCategory('')
            setDefaultBrand('')
            await loadStatus()
          } catch (err) {
            Alert.alert(describeImportError(err, t, ip.loadFailed))
          } finally {
            setDisconnecting(false)
          }
        },
      },
    ])
  }

  const onLoadPreview = async (nextPage: number) => {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const res = await getEasyOrdersPreview(nextPage)
      const defCat = defaultCategory ? Number(defaultCategory) : null
      const defBrand = defaultBrand ? Number(defaultBrand) : null
      const incoming = res.valid.map((r) => ({
        ...r,
        imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
        categoryId: r.categoryId ?? defCat,
        brandId: r.brandId ?? defBrand,
      }))
      if (nextPage === 1) {
        setRows(incoming)
        setPreviewErrors(res.errors)
      } else {
        setRows((prev) => [...(prev ?? []), ...incoming])
        setPreviewErrors((prev) => [...prev, ...res.errors])
      }
      setHasMore(res.hasMore)
      setPage(res.page)
    } catch (err) {
      if (err instanceof ImportApiError && err.status === 401) {
        setReconnectRequired(true)
        setConn('disconnected')
        resetPreview()
      } else {
        setPreviewError(describeImportError(err, t, ip.eoUpstreamError))
      }
    } finally {
      setLoadingPreview(false)
    }
  }

  // Website behaviour: picking a default overwrites every row; clearing leaves rows as they are.
  const onDefaultCategory = (v: string) => {
    setDefaultCategory(v)
    if (v) setRows((prev) => prev?.map((r) => ({ ...r, categoryId: Number(v) })) ?? prev)
  }
  const onDefaultBrand = (v: string) => {
    setDefaultBrand(v)
    if (v) setRows((prev) => prev?.map((r) => ({ ...r, brandId: Number(v) })) ?? prev)
  }

  const updateRow = (id: string, patch: Partial<EasyOrdersRow>) =>
    setRows((prev) => prev?.map((r) => (r.easyOrdersProductId === id ? { ...r, ...patch } : r)) ?? prev)
  const removeRow = (id: string) =>
    setRows((prev) => prev?.filter((r) => r.easyOrdersProductId !== id) ?? prev)

  const flatErrors = useMemo(() => flattenEasyOrdersErrors(previewErrors), [previewErrors])
  const missingCategory = rows?.some((r) => r.categoryId == null) ?? false
  const missingBrand = rows?.some((r) => r.brandId == null) ?? false
  const rowCount = rows?.length ?? 0
  const canConfirm = !confirm.busy && rowCount > 0 && !missingCategory && !missingBrand

  const onConfirm = () => {
    if (!rows || !canConfirm) return
    confirm.run(() =>
      confirmEasyOrders(
        rows.map((r) => ({
          easyOrdersProductId: r.easyOrdersProductId,
          rowNumber: r.rowNumber,
          title: r.title,
          description: r.description,
          price: r.price,
          imageUrls: r.imageUrls.slice(0, MAX_IMPORT_IMAGES),
          categoryId: r.categoryId as number,
          brandId: r.brandId as number,
        })),
      ),
    )
  }

  const steps = [ip.eoStep1, ip.eoStep2, ip.eoStep3, ip.eoStep4, ip.eoStep5]

  return (
    <DashboardLayout title={ip.easyOrdersTitle} scroll={false} contentPadding={false} bottomBar={<BottomTabBar />}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImportBackLink />
        <Text style={[styles.title, dirStyle]}>{ip.easyOrdersTitle}</Text>

        {conn === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.dk} />
            <Text style={styles.muted}>{ip.loading}</Text>
          </View>
        ) : null}

        {conn === 'error' ? (
          <View style={styles.card}>
            <Text style={[styles.errorText, dirStyle]}>{ip.loadFailed}</Text>
            <Button label={t.retry} variant="outline" onPress={loadStatus} />
          </View>
        ) : null}

        {conn === 'disconnected' ? (
          <View style={styles.card}>
            {reconnectRequired ? (
              <View style={styles.banner}>
                <Text style={[styles.bannerText, dirStyle]}>{ip.eoReconnectNeeded}</Text>
              </View>
            ) : null}

            <Text style={[styles.heading, dirStyle]}>{ip.eoConnectLabel}</Text>

            <View style={styles.steps}>
              <Text style={[styles.stepsTitle, dirStyle]}>{ip.eoStepsTitle}</Text>
              {steps.map((s, i) => (
                <View key={i} style={[styles.stepRow, rowDir]}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, dirStyle]}>{s}</Text>
                </View>
              ))}
            </View>

            <Image source={GUIDE_IMAGE} style={styles.guide} contentFit="contain" />

            <Input
              label={ip.eoApiKeyLabel}
              value={apiKey}
              onChangeText={(v) => {
                setApiKey(v)
                if (connectError) setConnectError(null)
              }}
              placeholder={ip.eoApiKeyPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={200}
              style={styles.mono}
              error={connectError ?? undefined}
            />

            <Button label={ip.eoConnectBtn} variant="y" fullWidth loading={connecting} disabled={connecting} onPress={onConnect} />

            <Pressable onPress={() => Linking.openURL(DASHBOARD_URL)} hitSlop={6} accessibilityRole="link">
              <Text style={[styles.link, dirStyle]}>{ip.eoOpenDashboard}</Text>
            </Pressable>
          </View>
        ) : null}

        {conn === 'connected' ? (
          <>
            <View style={styles.card}>
              <View style={[styles.connRow, rowDir]}>
                <View style={[styles.pill, rowDir]}>
                  <View style={styles.pillDot} />
                  <Text style={styles.pillText}>{ip.eoConnected}</Text>
                </View>
                <Pressable onPress={onDisconnect} disabled={disconnecting} hitSlop={6} accessibilityRole="button">
                  <Text style={styles.disconnect}>{ip.disconnect}</Text>
                </Pressable>
              </View>
              {connectedAt ? (
                <Text style={[styles.muted, dirStyle]}>
                  {ip.connectedSince.replace(
                    '{date}',
                    new Date(connectedAt).toLocaleString(ar ? 'ar-EG' : 'en-US'),
                  )}
                </Text>
              ) : null}
            </View>

            <DefaultCategoryBrand
              categoryOptions={categoryOptions}
              brandOptions={brandOptions}
              category={defaultCategory}
              brand={defaultBrand}
              onCategoryChange={onDefaultCategory}
              onBrandChange={onDefaultBrand}
            />

            {rows === null ? (
              <Button
                label={ip.eoLoadBtn}
                variant="dk"
                fullWidth
                loading={loadingPreview}
                disabled={loadingPreview}
                onPress={() => onLoadPreview(1)}
              />
            ) : null}

            {previewError ? <Text style={[styles.errorText, dirStyle]}>{previewError}</Text> : null}

            {rows !== null ? (
              <>
                <Text style={[styles.heading, dirStyle]}>
                  {rowCount > 0 ? ip.rowsCount.replace('{count}', String(rowCount)) : ip.noRows}
                </Text>

                {rows.map((r) => (
                  <ImportRowCard
                    key={r.easyOrdersProductId}
                    rowNumber={r.rowNumber}
                    title={r.title}
                    price={r.price}
                    images={r.imageUrls}
                    categoryId={r.categoryId}
                    brandId={r.brandId}
                    categoryOptions={categoryOptions}
                    brandOptions={brandOptions}
                    onCategoryChange={(id) => updateRow(r.easyOrdersProductId, { categoryId: id })}
                    onBrandChange={(id) => updateRow(r.easyOrdersProductId, { brandId: id })}
                    onRemove={() => removeRow(r.easyOrdersProductId)}
                  />
                ))}

                <ImportErrors errors={flatErrors} />

                {hasMore ? (
                  <Button
                    label={ip.loadMore}
                    variant="outline"
                    fullWidth
                    loading={loadingPreview}
                    disabled={loadingPreview}
                    onPress={() => onLoadPreview(page + 1)}
                  />
                ) : null}

                {rowCount > 0 && missingCategory ? (
                  <Text style={[styles.hint, dirStyle]}>{ip.pickCategoryForEachRow}</Text>
                ) : rowCount > 0 && missingBrand ? (
                  <Text style={[styles.hint, dirStyle]}>{ip.pickBrandForEachRow}</Text>
                ) : null}

                {confirm.error ? <Text style={[styles.errorText, dirStyle]}>{confirm.error}</Text> : null}

                <Button
                  label={confirm.busy ? ip.saving : ip.confirmBtn.replace('{count}', String(rowCount))}
                  variant="cta"
                  fullWidth
                  loading={confirm.busy}
                  disabled={!canConfirm}
                  onPress={onConfirm}
                  style={!canConfirm && !confirm.busy ? styles.disabled : undefined}
                />
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.dk },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  card: {
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
  banner: {
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
    padding: spacing.sm,
  },
  bannerText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.dk },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.dk },
  steps: { gap: spacing.sm },
  stepsTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.g700 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.bold, fontSize: 12, color: colors.dk },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.g700, lineHeight: 20 },
  guide: {
    width: '100%',
    aspectRatio: 1600 / 781,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g300,
    backgroundColor: colors.g100,
  },
  mono: { fontFamily: 'monospace', writingDirection: 'ltr', textAlign: 'left' },
  link: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.dk, textDecorationLine: 'underline' },
  connRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#15803d' },
  pillText: { fontFamily: fonts.bold, fontSize: 12, color: '#15803d' },
  disconnect: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red, textDecorationLine: 'underline' },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500 },
  hint: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  errorText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  disabled: { opacity: 0.5 },
})
