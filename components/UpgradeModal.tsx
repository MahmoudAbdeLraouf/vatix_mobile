import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { authFetch, authPost, updateStoredUser } from '@/lib/auth'
import {
  getSiteSettings,
  getSubscriptionPlans,
  PlanData,
  SiteSettings,
  WalletBalance,
} from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'

// Mirrors vatix_website/components/upgrade-modal.tsx
// Three modes × seven-step flow:
//   Mode: upgrade-to-store | upgrade-to-plus | cancel-store
//   Step: store-info → pay-method → card | instapay → instapay-done
//         pay-method → wallet → wallet-done
// upgrade-to-plus skips store-info (user already has store profile).

export type UpgradeMode = 'upgrade-to-store' | 'upgrade-to-plus' | 'cancel-store'
type Step =
  | 'store-info'
  | 'pay-method'
  | 'instapay'
  | 'instapay-done'
  | 'wallet'
  | 'wallet-done'

interface Props {
  visible: boolean
  mode: UpgradeMode
  onClose: () => void
  onSuccess?: () => void
}

const PLAN_META: Record<'store' | 'store_plus', { code: string; fallbackPrice: number }> = {
  store: { code: 'subscription_store', fallbackPrice: 300 },
  store_plus: { code: 'subscription_store_plus', fallbackPrice: 500 },
}

// LocaleProvider applies `direction: 'rtl'` at the tree root. Under inherited
// RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve visually
// BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so the first
// child anchors to the physical right. `colDir` restores RTL context inside
// those rows so nested text uses `textAlign: 'auto'` = start alignment.
function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar
      ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const })
      : null,
    colDir: ar ? ({ direction: 'rtl' as const }) : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
    trailAlign: {
      alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
    },
  }
}

export function UpgradeModal({ visible, mode, onClose, onSuccess }: Props) {
  const { t } = useLocale()
  const { ar, rowDir } = useDir()
  const insets = useSafeAreaInsets()
  const { user, refetchUser } = useAuth()

  // A client tapping "Upgrade to Plus" has no storeProfile yet, so they must
  // still run store-info + handleCreateStore before payment. Only skip that
  // step when the user is already a store (upgrading tier).
  const userType = user?.type
  const hasStoreAlready =
    userType === 'STORE' ||
    userType === 'store' ||
    userType === 'STORE_PLUS' ||
    userType === 'store_plus'
  const needsStoreCreation = mode !== 'cancel-store' && !hasStoreAlready

  const [step, setStep] = useState<Step>(
    needsStoreCreation ? 'store-info' : 'pay-method',
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Mount-time data
  const [plans, setPlans] = useState<PlanData[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [wallet, setWallet] = useState<WalletBalance | null>(null)

  // Store-info form — storeType is fully determined by mode (which CTA was tapped);
  // no in-modal selector.
  const storeType: 'store' | 'store_plus' = mode === 'upgrade-to-plus' ? 'store_plus' : 'store'
  const [storeName, setStoreName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [cover, setCover] = useState('')

  // InstaPay form
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')

  // Reset when opened
  useEffect(() => {
    if (!visible) return
    setStep(needsStoreCreation ? 'store-info' : 'pay-method')
    setErr('')
    setBusy(false)
    setStoreName('')
    setDescription('')
    setLogo('')
    setCover('')
    setScreenshotUrl('')
    setBuyerPhone('')
  }, [visible, mode, needsStoreCreation])

  // Load plans + settings + wallet on open
  useEffect(() => {
    if (!visible) return
    let live = true
    ;(async () => {
      const [p, s, w] = await Promise.all([
        getSubscriptionPlans().catch(() => [] as PlanData[]),
        getSiteSettings().catch(() => null),
        authFetch<WalletBalance>('/payments/wallet/balance'),
      ])
      if (!live) return
      setPlans(p)
      setSettings(s)
      setWallet(w)
    })()
    return () => {
      live = false
    }
  }, [visible])

  // Selected plan amount for pay-method / card / instapay / wallet steps
  const selectedType: 'store' | 'store_plus' = storeType
  const selectedPlan = useMemo(() => {
    const meta = PLAN_META[selectedType]
    const priceStr = plans.find(p => p.storeType === selectedType)?.price
    const priceNum = priceStr != null ? Number(priceStr) : meta.fallbackPrice
    return {
      code: meta.code,
      amount: Number.isFinite(priceNum) ? priceNum : meta.fallbackPrice,
    }
  }, [plans, selectedType])

  const walletBalance = wallet?.balance ?? null

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleCancelStore() {
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/user/cancel-store', {})
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      onSuccess?.()
      onClose()
      router.replace('/dashboard')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateStore(): Promise<boolean> {
    if (!storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return false
    }
    setBusy(true)
    setErr('')
    try {
      const payload: Record<string, unknown> = {
        storeName: storeName.trim(),
        storeType,
      }
      if (description.trim()) payload.description = description.trim()
      if (logo) payload.logo = logo
      if (cover) payload.cover = cover

      const res = await authPost<{ user?: unknown }>('/user/upgrade-to-store', payload)
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      return true
    } catch (e) {
      setErr((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  function handleCardPayment() {
    onClose()
    router.push({
      pathname: '/checkout',
      params: { context: 'subscription', type: selectedPlan.code, gateway: 'kashier' },
    })
  }

  async function handleInstapaySubmit() {
    if (!screenshotUrl) {
      setErr(ar ? 'صورة التحويل مطلوبة' : 'Screenshot required')
      return
    }
    if (!buyerPhone.trim()) {
      setErr(ar ? 'رقم الهاتف مطلوب' : 'Phone number required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await authPost('/payments/instapay/subscriptions', {
        type: selectedPlan.code,
        screenshotUrl,
        buyerPhone: buyerPhone.trim(),
        metadata: {},
      })
      setStep('instapay-done')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleWalletPayment() {
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/payments/wallet/pay', {
        type: selectedPlan.code,
        metadata: {},
      })
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      const fresh = await authFetch<WalletBalance>('/payments/wallet/balance')
      setWallet(fresh)
      setStep('wallet-done')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ─── Title ─────────────────────────────────────────────────────────────────

  const currencyLabel = ar ? 'ج.م' : 'EGP'
  const priceLabel = `${selectedPlan.amount} ${currencyLabel}`
  const title =
    mode === 'cancel-store'
      ? t.cancelStore
      : mode === 'upgrade-to-plus'
        ? `${t.upgradeToStorePlus} · ${priceLabel}`
        : `${t.upgradeToStore} · ${priceLabel}`

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text
              style={[styles.sheetTitle, { writingDirection: ar ? 'rtl' : 'ltr' }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior="padding"
            enabled={Platform.OS === 'ios'}
            keyboardVerticalOffset={20}
          >
            <ScrollView
              contentContainerStyle={{ padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {mode === 'cancel-store' ? (
                <CancelStorePanel
                  err={err}
                  busy={busy}
                  onCancel={onClose}
                  onConfirm={handleCancelStore}
                  confirmText={t.cancelStoreConfirm}
                />
              ) : step === 'store-info' ? (
                <StoreInfoPanel
                  storeName={storeName}
                  onStoreNameChange={setStoreName}
                  description={description}
                  onDescriptionChange={setDescription}
                  logo={logo}
                  onLogoChange={setLogo}
                  cover={cover}
                  onCoverChange={setCover}
                  price={selectedPlan.amount}
                  err={err}
                  busy={busy}
                  onBack={onClose}
                  onNext={() => {
                    if (!storeName.trim()) {
                      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
                      return
                    }
                    setErr('')
                    setStep('pay-method')
                  }}
                />
              ) : step === 'pay-method' ? (
                <PayMethodPanel
                  price={selectedPlan.amount}
                  settings={settings}
                  walletBalance={walletBalance}
                  err={err}
                  busy={busy}
                  hasBack={needsStoreCreation}
                  isCreatingStore={needsStoreCreation}
                  onBack={() =>
                    needsStoreCreation ? setStep('store-info') : onClose()
                  }
                  onPickCard={async () => {
                    if (needsStoreCreation) {
                      const ok = await handleCreateStore()
                      if (!ok) return
                    }
                    handleCardPayment()
                  }}
                  onPickInstapay={async () => {
                    if (needsStoreCreation) {
                      const ok = await handleCreateStore()
                      if (!ok) return
                    }
                    setStep('instapay')
                  }}
                  onPickWallet={async () => {
                    if (needsStoreCreation) {
                      const ok = await handleCreateStore()
                      if (!ok) return
                    }
                    setStep('wallet')
                  }}
                />
              ) : step === 'instapay' ? (
                <InstapayPanel
                  settings={settings}
                  price={selectedPlan.amount}
                  screenshotUrl={screenshotUrl}
                  onScreenshotChange={setScreenshotUrl}
                  buyerPhone={buyerPhone}
                  onBuyerPhoneChange={setBuyerPhone}
                  err={err}
                  busy={busy}
                  onBack={() => setStep('pay-method')}
                  onSubmit={handleInstapaySubmit}
                />
              ) : step === 'instapay-done' ? (
                <DonePanel
                  title={t.instapaySubmitted}
                  body={t.paymentPendingBody}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  ctaLabel={t.continueToStore}
                />
              ) : step === 'wallet' ? (
                <WalletPanel
                  price={selectedPlan.amount}
                  walletBalance={walletBalance}
                  err={err}
                  busy={busy}
                  onBack={() => setStep('pay-method')}
                  onPay={handleWalletPayment}
                />
              ) : step === 'wallet-done' ? (
                <DonePanel
                  title={t.paymentSuccess}
                  body={t.paymentSuccessBody}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  ctaLabel={t.continueToStore}
                />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function ErrorBox({ err }: { err: string }) {
  const { rowDir, colDir, dirStyle } = useDir()
  if (!err) return null
  return (
    <View style={[styles.errorBox, rowDir]}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
      <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
        <Text style={[styles.errorText, dirStyle]}>{err}</Text>
      </View>
    </View>
  )
}

function StoreInfoPanel(props: {
  storeName: string
  onStoreNameChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  logo: string
  onLogoChange: (v: string) => void
  cover: string
  onCoverChange: (v: string) => void
  price: number
  err: string
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  const { storeName, onStoreNameChange } = props
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()

  return (
    <View>
      <Input
        label={ar ? 'اسم المتجر *' : 'Store name *'}
        value={storeName}
        onChangeText={onStoreNameChange}
        placeholder={ar ? 'مثال: متجر إلكترونيات القاهرة' : 'e.g. Cairo Electronics'}
      />
      <Input
        label={t.storeDescription}
        value={props.description}
        onChangeText={props.onDescriptionChange}
        placeholder={ar ? 'وصف موجز لمتجرك' : 'Short store description'}
        multiline
        numberOfLines={3}
        style={{ height: 84, textAlignVertical: 'top', paddingTop: 12 }}
      />

      <FileUpload
        label={t.storeLogo}
        value={props.logo}
        onChange={props.onLogoChange}
        aspect="square"
      />
      <FileUpload
        label={t.storeCover}
        value={props.cover}
        onChange={props.onCoverChange}
        aspect="wide"
      />

      <View style={[styles.priceRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.priceLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.priceValue}>
          {props.price} {ar ? 'ج.م' : 'EGP'} <Text style={styles.priceUnit}>/{t.monthlyBilling}</Text>
        </Text>
      </View>

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'إلغاء' : 'Cancel'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={ar ? 'التالي' : 'Next'}
            variant="y"
            size="md"
            onPress={props.onNext}
            disabled={props.busy}
          />
        </View>
      </View>
    </View>
  )
}

function PayMethodPanel(props: {
  price: number
  settings: SiteSettings | null
  walletBalance: number | null
  err: string
  busy: boolean
  hasBack: boolean
  isCreatingStore: boolean
  onBack: () => void
  onPickCard: () => void
  onPickInstapay: () => void
  onPickWallet: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { settings, walletBalance, price } = props
  const kashierOn = settings?.kashierEnabled ?? false
  const instapayOn = settings?.instapayEnabled ?? false
  const walletShort = walletBalance != null && walletBalance < price

  return (
    <View>
      <View style={colDir}>
        <Text style={[styles.stepHeading, dirStyle]}>{t.choosePaymentMethod}</Text>
      </View>

      <View style={[styles.priceRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.priceLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.priceValue}>
          {price} {ar ? 'ج.م' : 'EGP'}
        </Text>
      </View>

      <View style={styles.methodList}>
        {kashierOn ? (
          <MethodCard
            icon="card-outline"
            iconColor={colors.dk}
            title={t.payWithCard}
            subtitle={ar ? 'دفع فوري بالبطاقة' : 'Instant card payment'}
            onPress={props.onPickCard}
            disabled={props.busy}
          />
        ) : null}
        {instapayOn ? (
          <MethodCard
            icon="phone-portrait-outline"
            iconColor={'#7B2FBE'}
            title={t.payWithInstapay}
            subtitle={ar ? 'تحويل يدوي + إثبات' : 'Manual transfer + proof'}
            onPress={props.onPickInstapay}
            disabled={props.busy}
            gradientBg
          />
        ) : null}
        <MethodCard
          icon="wallet-outline"
          iconColor={colors.y}
          title={t.payWithWallet}
          subtitle={
            walletBalance != null
              ? `${t.walletBalance}: ${walletBalance} ${ar ? 'ج.م' : 'EGP'}`
              : t.walletBalance
          }
          onPress={props.onPickWallet}
          disabled={props.busy || walletShort}
          warn={walletShort ? t.insufficientBalance : undefined}
        />
      </View>

      <ErrorBox err={props.err} />

      {props.hasBack ? (
        <View style={[styles.actions, rowDir]}>
          <View style={{ flex: 1 }}>
            <Button
              label={ar ? 'رجوع' : 'Back'}
              variant="outline"
              size="md"
              onPress={props.onBack}
              disabled={props.busy}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

function MethodCard({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  disabled,
  warn,
  gradientBg,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle: string
  onPress: () => void
  disabled?: boolean
  warn?: string
  gradientBg?: boolean
}) {
  const { ar, rowDir, colDir, dirStyle } = useDir()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.methodCard,
        rowDir,
        gradientBg && { backgroundColor: '#F6EFFB', borderColor: '#D6BCEF' },
        pressed && !disabled && { opacity: 0.95, transform: [{ scale: 0.99 }] },
        disabled && { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
      ]}
    >
      <View style={[styles.methodIconWrap, { backgroundColor: colors.white }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
        <Text style={[styles.methodTitle, dirStyle]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.methodSubtitle, dirStyle]} numberOfLines={2}>{subtitle}</Text>
        {warn ? (
          <Text style={[styles.methodWarn, dirStyle]} numberOfLines={1}>{warn}</Text>
        ) : null}
      </View>
      <Ionicons
        name={ar ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={colors.g400}
      />
    </Pressable>
  )
}

function InstapayPanel(props: {
  settings: SiteSettings | null
  price: number
  screenshotUrl: string
  onScreenshotChange: (v: string) => void
  buyerPhone: string
  onBuyerPhoneChange: (v: string) => void
  err: string
  busy: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { settings, price } = props

  return (
    <View>
      <View style={[styles.instapayBanner, rowDir]}>
        <Ionicons name="phone-portrait" size={24} color="#7B2FBE" />
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.instapayBannerText, dirStyle]}>{t.payWithInstapay}</Text>
        </View>
      </View>

      <View style={[styles.detailRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.detailLabel, dirStyle]}>{t.instapayAccountLabel}</Text>
        </View>
        <Text style={styles.detailValue} selectable>
          {settings?.instapayAccount ?? '—'}
        </Text>
      </View>
      <View style={[styles.detailRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.detailLabel, dirStyle]}>{t.instapayNameLabel}</Text>
        </View>
        <Text style={styles.detailValue} selectable>
          {settings?.instapayName ?? '—'}
        </Text>
      </View>
      <View style={[styles.detailRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.detailLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.detailValue}>
          {price} {ar ? 'ج.م' : 'EGP'}
        </Text>
      </View>

      <View style={colDir}>
        <Text style={[styles.helpText, dirStyle, { marginTop: spacing.md }]}>
          {t.instapayInstructions}
        </Text>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FileUpload
          label={t.uploadScreenshot}
          value={props.screenshotUrl}
          onChange={props.onScreenshotChange}
          aspect="wide"
          hint={t.screenshotRequired}
        />
      </View>

      <Input
        label={t.buyerPhone}
        value={props.buyerPhone}
        onChangeText={props.onBuyerPhoneChange}
        placeholder="01012345678"
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
        // Phone numbers render LTR regardless of UI locale.
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <View style={colDir}>
        <Text style={[styles.helpText, dirStyle, { marginTop: -spacing.sm }]}>
          {t.buyerPhoneHint}
        </Text>
      </View>

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={t.submitPayment}
            variant="y"
            size="md"
            onPress={props.onSubmit}
            loading={props.busy}
          />
        </View>
      </View>
    </View>
  )
}

function WalletPanel(props: {
  price: number
  walletBalance: number | null
  err: string
  busy: boolean
  onBack: () => void
  onPay: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { price, walletBalance } = props
  const short = walletBalance != null && walletBalance < price

  return (
    <View>
      <View style={[styles.walletBanner, rowDir]}>
        <Ionicons name="wallet" size={24} color={colors.y} />
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.walletBannerLabel, dirStyle]}>{t.walletBalance}</Text>
          <Text style={[styles.walletBannerValue, dirStyle]}>
            {walletBalance ?? 0} {ar ? 'ج.م' : 'EGP'}
          </Text>
        </View>
      </View>

      <View style={[styles.detailRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.detailLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.detailValue}>
          {price} {ar ? 'ج.م' : 'EGP'}
        </Text>
      </View>

      {short ? (
        <View style={[styles.errorBox, rowDir, { marginTop: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
          <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
            <Text style={[styles.errorText, dirStyle]}>{t.insufficientBalance}</Text>
          </View>
        </View>
      ) : null}

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={t.payWithWallet}
            variant="y"
            size="md"
            onPress={props.onPay}
            loading={props.busy}
            disabled={short}
          />
        </View>
      </View>
    </View>
  )
}

function DonePanel({
  title,
  body,
  onClose,
  ctaLabel,
}: {
  title: string
  body: string
  onClose: () => void
  ctaLabel: string
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View style={styles.successCircle}>
        <Ionicons name="checkmark" size={40} color={colors.white} />
      </View>
      <Text style={[styles.stepHeading, { marginTop: spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[styles.helpText, { textAlign: 'center', marginTop: spacing.sm }]}>{body}</Text>
      <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
        <Button label={ctaLabel} variant="y" size="md" onPress={onClose} />
      </View>
    </View>
  )
}

function CancelStorePanel({
  err,
  busy,
  confirmText,
  onCancel,
  onConfirm,
}: {
  err: string
  busy: boolean
  confirmText: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { ar, rowDir, colDir, dirStyle } = useDir()
  function ask() {
    Alert.alert(
      ar ? 'تأكيد الإلغاء' : 'Confirm cancellation',
      confirmText,
      [
        { text: ar ? 'رجوع' : 'Back', style: 'cancel' },
        { text: ar ? 'تأكيد' : 'Confirm', style: 'destructive', onPress: onConfirm },
      ],
      { cancelable: true },
    )
  }
  return (
    <View>
      <View style={[styles.warningBox, rowDir]}>
        <Ionicons name="warning-outline" size={22} color={colors.red} />
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.warningText, dirStyle]}>{confirmText}</Text>
        </View>
      </View>
      <ErrorBox err={err} />
      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={onCancel}
            disabled={busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={ar ? 'تأكيد الإلغاء' : 'Confirm cancel'}
            variant="red"
            size="md"
            onPress={ask}
            loading={busy}
          />
        </View>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    ...shadow.sl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetTitle: {
    flexShrink: 1,
    marginEnd: spacing.sm,
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
  },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  stepHeading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  typeIcon: {
    fontSize: 22,
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
    textAlign: 'center',
  },
  typeSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.g100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  priceValue: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
  },
  priceUnit: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  methodList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    ...shadow.ss,
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.g200,
  },
  methodTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  methodSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    marginTop: 2,
  },
  methodWarn: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.red,
    marginTop: 4,
  },
  instapayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#F6EFFB',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  instapayBannerText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#7B2FBE',
  },
  walletBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.yl,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  walletBannerLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
  },
  walletBannerValue: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  detailLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  helpText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.rl,
    borderColor: colors.red,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.red,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.rl,
    borderColor: colors.red,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
})
