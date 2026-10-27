import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { DashboardLayout } from '@/components/DashboardLayout'
import { BottomTabBar } from '@/components/BottomTabBar'
import { Button } from '@/components/ui/Button'
import { ImportBackLink } from '@/components/import/ImportBackLink'
import { ClientCapCard } from '@/components/import/ClientCapCard'
import { DefaultCategoryBrand } from '@/components/import/DefaultCategoryBrand'
import { ImportRowCard } from '@/components/import/ImportRowCard'
import { ImportErrors } from '@/components/import/ImportErrors'
import { useImportOptions } from '@/hooks/useImportOptions'
import { describeImportError, useImportConfirm } from '@/hooks/useImportConfirm'
import { useLocale } from '@/contexts/locale'
import {
  ImportApiError,
  MAX_IMPORT_IMAGES,
  confirmShopify,
  disconnectShopify,
  getShopifyInstallUrl,
  getShopifyPreview,
  getShopifyStatus,
  normalizeShopDomain,
  type ImportPreviewError,
  type ShopifyRow,
} from '@/lib/import'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const SHOP_SUFFIX = '.myshopify.com'
const RETURN_URL = 'vatix://import/shopify'

type ConnState = 'loading' | 'error' | 'disconnected' | 'connected'

// Shopify import — mirrors the website's Shopify tab
// (vatix_website/app/dashboard/products/import/page.tsx).
export default function ShopifyImportScreen() {
  const { t, locale } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
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
  const confirm = useImportConfirm('shopify')

  const [conn, setConn] = useState<ConnState>('loading')
  const [shop, setShop] = useState<string | null>(null)
  const [reconnectRequired, setReconnectRequired] = useState(false)

  const [shopInput, setShopInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  // Set while the OAuth browser is open, so returning to the app re-checks the status once.
  const awaitingAuth = useRef(false)

  const [defaultCategory, setDefaultCategory] = useState('')
  const [defaultBrand, setDefaultBrand] = useState('')

  const [rows, setRows] = useState<ShopifyRow[] | null>(null)
  const [previewErrors, setPreviewErrors] = useState<ImportPreviewError[]>([])
  const [skippedExisting, setSkippedExisting] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setConn('loading')
    try {
      const status = await getShopifyStatus()
      setShop(status.shop ?? null)
      if (status.connected) setReconnectRequired(false)
      setConn(status.connected ? 'connected' : 'disconnected')
    } catch {
      setConn('error')
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Without a backend redirect to vatix://, the user closes the browser manually;
  // coming back to the foreground is our cue to re-check the connection.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && awaitingAuth.current) {
        awaitingAuth.current = false
        loadStatus()
      }
    })
    return () => sub.remove()
  }, [loadStatus])

  const resetPreview = () => {
    setRows(null)
    setPreviewErrors([])
    setSkippedExisting(0)
    setPreviewError(null)
    confirm.setError(null)
  }

  const normalizedShop = normalizeShopDomain(shopInput)
  const canConnect = normalizedShop.length > SHOP_SUFFIX.length

  const onConnect = async () => {
    if (!canConnect) {
      setConnectError(ip.shopInvalid)
      return
    }
    setConnecting(true)
    setConnectError(null)
    try {
      const { installUrl } = await getShopifyInstallUrl(normalizedShop)
      awaitingAuth.current = true
      await WebBrowser.openAuthSessionAsync(installUrl, RETURN_URL)
      // Whatever the browser result was, the backend is the source of truth.
      awaitingAuth.current = false
      await loadStatus()
    } catch (err) {
      awaitingAuth.current = false
      if (err instanceof ImportApiError && err.status === 400) {
        setConnectError(err.message || ip.shopInvalid)
      } else {
        setConnectError(describeImportError(err, t, ip.loadFailed))
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
            await disconnectShopify()
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

  const onLoadPreview = async () => {
    setLoadingPreview(true)
    setPreviewError(null)
    confirm.setError(null)
    try {
      const res = await getShopifyPreview(50)
      const defCat = defaultCategory ? Number(defaultCategory) : null
      const defBrand = defaultBrand ? Number(defaultBrand) : null
      setRows(
        res.valid.map((r) => ({
          ...r,
          imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
          categoryId: defCat,
          brandId: defBrand,
        })),
      )
      setPreviewErrors(res.errors ?? [])
      setSkippedExisting(res.skippedExisting ?? 0)
    } catch (err) {
      if (
        err instanceof ImportApiError &&
        (err.code === 'SHOPIFY_RECONNECT_REQUIRED' || err.status === 401)
      ) {
        setReconnectRequired(true)
        setConn('disconnected')
        resetPreview()
      } else {
        setPreviewError(describeImportError(err, t, ip.loadFailed))
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

  const updateRow = (id: string, patch: Partial<ShopifyRow>) =>
    setRows((prev) => prev?.map((r) => (r.shopifyId === id ? { ...r, ...patch } : r)) ?? prev)
  const removeRow = (id: string) =>
    setRows((prev) => prev?.filter((r) => r.shopifyId !== id) ?? prev)

  const missingCategory = rows?.some((r) => r.categoryId == null) ?? false
  const missingBrand = rows?.some((r) => r.brandId == null) ?? false
  const rowCount = rows?.length ?? 0
  const hasErrors = previewErrors.length > 0
  const canConfirm = !confirm.busy && rowCount > 0 && !hasErrors && !missingCategory && !missingBrand

  const onConfirm = () => {
    if (!rows || !canConfirm) return
    confirm.run(() =>
      confirmShopify(
        rows.map((r) => ({
          shopifyId: r.shopifyId,
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

  return (
    <DashboardLayout title={ip.shopifyTitle} scroll={false} contentPadding={false} bottomBar={<BottomTabBar />}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImportBackLink />
        <ClientCapCard screen="shopify" />
        <Text style={[styles.title, dirStyle]}>{ip.shopifyTitle}</Text>

        {conn === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.heading} />
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
                <Text style={[styles.bannerText, dirStyle]}>{ip.shopReconnectNeeded}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, dirStyle]}>{ip.shopLabel}</Text>
              {/* Domain is always LTR, even in Arabic. */}
              <View style={[styles.domainBox, connectError ? styles.domainBoxError : null]}>
                <TextInput
                  value={shopInput}
                  onChangeText={(v) => {
                    setShopInput(v)
                    if (connectError) setConnectError(null)
                  }}
                  placeholder={ip.shopPlaceholder}
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={onConnect}
                  maxLength={120}
                  style={styles.domainInput}
                />
                <View style={styles.suffix}>
                  <Text style={styles.suffixText}>{SHOP_SUFFIX}</Text>
                </View>
              </View>
              {connectError ? (
                <Text style={[styles.errorText, dirStyle]}>{connectError}</Text>
              ) : (
                <Text style={[styles.muted, dirStyle]}>{ip.shopHint}</Text>
              )}
            </View>

            <Button
              label={ip.shopConnectBtn}
              variant="y"
              fullWidth
              loading={connecting}
              disabled={connecting || !canConnect}
              onPress={onConnect}
              style={!canConnect && !connecting ? styles.disabled : undefined}
            />
          </View>
        ) : null}

        {conn === 'connected' ? (
          <>
            <View style={styles.card}>
              <View style={[styles.connRow, rowDir]}>
                <View style={[styles.pill, rowDir]}>
                  <View style={styles.pillDot} />
                  <Text style={styles.pillText} numberOfLines={1}>
                    {ip.shopConnectedTo.replace('{shop}', shop ?? 'Shopify')}
                  </Text>
                </View>
                <Pressable onPress={onDisconnect} disabled={disconnecting} hitSlop={6} accessibilityRole="button">
                  <Text style={styles.disconnect}>{ip.disconnect}</Text>
                </Pressable>
              </View>
              <Text style={[styles.muted, dirStyle]}>{ip.shopFirstBatchHint}</Text>
            </View>

            <DefaultCategoryBrand
              categoryOptions={categoryOptions}
              brandOptions={brandOptions}
              category={defaultCategory}
              brand={defaultBrand}
              onCategoryChange={onDefaultCategory}
              onBrandChange={onDefaultBrand}
            />

            <Button
              label={ip.shopLoadBtn}
              variant={rows === null ? 'dk' : 'outline'}
              fullWidth
              loading={loadingPreview}
              disabled={loadingPreview || confirm.busy}
              onPress={onLoadPreview}
            />

            {previewError ? <Text style={[styles.errorText, dirStyle]}>{previewError}</Text> : null}

            {rows !== null ? (
              <>
                <Text style={[styles.heading, dirStyle]}>
                  {rowCount > 0 ? ip.rowsCount.replace('{count}', String(rowCount)) : ip.noRows}
                </Text>
                {skippedExisting > 0 ? (
                  <Text style={[styles.muted, dirStyle]}>
                    {ip.skippedExisting.replace('{n}', String(skippedExisting))}
                  </Text>
                ) : null}

                {rows.map((r) => (
                  <ImportRowCard
                    key={r.shopifyId}
                    rowNumber={r.rowNumber}
                    title={r.title}
                    price={r.price}
                    images={r.imageUrls}
                    categoryId={r.categoryId}
                    brandId={r.brandId}
                    categoryOptions={categoryOptions}
                    brandOptions={brandOptions}
                    onCategoryChange={(id) => updateRow(r.shopifyId, { categoryId: id })}
                    onBrandChange={(id) => updateRow(r.shopifyId, { brandId: id })}
                    onRemove={() => removeRow(r.shopifyId)}
                  />
                ))}

                <ImportErrors errors={previewErrors} />

                {hasErrors ? (
                  <Text style={[styles.hint, dirStyle]}>{ip.fixErrors}</Text>
                ) : rowCount > 0 && missingCategory ? (
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

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.heading },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  card: {
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.ss),
  },
  banner: {
    borderRadius: radius.md,
    backgroundColor: colors.yellowBg,
    borderWidth: 1,
    borderColor: colors.y,
    padding: spacing.sm,
  },
  bannerText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.heading },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.heading },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  domainBox: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'stretch',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  domainBoxError: { borderColor: colors.red },
  domainInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  suffix: {
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.placeholder,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  suffixText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted },
  connRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: dark ? colors.greenBg : '#dcfce7',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: dark ? colors.green : '#15803d' },
  pillText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 12, color: dark ? colors.green : '#15803d' },
  disconnect: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red, textDecorationLine: 'underline' },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  hint: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  errorText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  disabled: { opacity: 0.5 },
})
