import React, { useEffect, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { authErrorMessage, authPost } from '@/lib/auth'
import { getSiteSettings, SiteSettings } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'

// Mirrors vatix_website/components/wallet-topup-modal.tsx
// InstaPay-only flow: manual transfer + screenshot proof, admin-reviewed.

type Step = 'amount' | 'instapay' | 'instapay-done'

const PRESETS = [50, 100, 200, 500] as const
const MIN_AMOUNT = 10

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
}

// Canonical RTL helper — mirrors UpgradeModal's useDir(). Under inherited
// RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve
// visually BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so
// the first child anchors to the physical right. `colDir` restores RTL
// context inside those rows so nested text uses `textAlign: 'auto'` =
// start alignment.
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
  }
}

export function WalletTopupModal({ visible, onClose, onSuccess }: Props) {
  const { t } = useLocale()
  const { ar, rowDir } = useDir()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [screenshotKey, setScreenshotKey] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')

  useEffect(() => {
    if (!visible) return
    setStep('amount')
    setAmount('')
    setErr('')
    setBusy(false)
    setScreenshotKey('')
    setBuyerPhone('')
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let live = true
    ;(async () => {
      const s = await getSiteSettings().catch(() => null)
      if (live) setSettings(s)
    })()
    return () => {
      live = false
    }
  }, [visible])

  const parsedAmount = useMemo(() => {
    const n = Number(amount)
    return Number.isFinite(n) ? n : 0
  }, [amount])
  const amountValid = parsedAmount >= MIN_AMOUNT

  async function handleInstapay() {
    if (!screenshotKey) {
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
      await authPost('/payments/wallet/topup/instapay', {
        amount: parsedAmount,
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
      })
      setStep('instapay-done')
    } catch (e: unknown) {
      setErr(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text style={styles.sheetTitle}>{t.topUpWallet}</Text>
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
              {step === 'amount' ? (
                <AmountPanel
                  amount={amount}
                  onAmountChange={setAmount}
                  parsedAmount={parsedAmount}
                  amountValid={amountValid}
                  settings={settings}
                  err={err}
                  busy={busy}
                  onClose={onClose}
                  onInstapay={() => {
                    if (!amountValid) {
                      setErr(
                        ar
                          ? `الحد الأدنى ${MIN_AMOUNT} ج.م`
                          : `Minimum is ${MIN_AMOUNT} EGP`,
                      )
                      return
                    }
                    setErr('')
                    setStep('instapay')
                  }}
                />
              ) : step === 'instapay' ? (
                <InstapayPanel
                  settings={settings}
                  amount={parsedAmount}
                  screenshotKey={screenshotKey}
                  onScreenshotChange={setScreenshotKey}
                  buyerPhone={buyerPhone}
                  onBuyerPhoneChange={setBuyerPhone}
                  err={err}
                  busy={busy}
                  onBack={() => setStep('amount')}
                  onSubmit={handleInstapay}
                />
              ) : step === 'instapay-done' ? (
                <DonePanel
                  amount={parsedAmount}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
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

function AmountPanel(props: {
  amount: string
  onAmountChange: (v: string) => void
  parsedAmount: number
  amountValid: boolean
  settings: SiteSettings | null
  err: string
  busy: boolean
  onClose: () => void
  onInstapay: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { amount, onAmountChange, parsedAmount, amountValid, settings } = props
  const instapayOn = settings?.instapayEnabled ?? false

  return (
    <View>
      <View style={colDir}>
        <Text style={[styles.stepHeading, dirStyle]}>{t.topUpAmount}</Text>
      </View>

      <View style={colDir}>
        <Text style={[styles.sectionLabel, dirStyle]}>
          {ar ? 'اختر مبلغاً سريعاً' : 'Choose a quick amount'}
        </Text>
      </View>
      <View style={[styles.presetGrid, rowDir]}>
        {PRESETS.map(v => {
          const active = String(v) === amount
          return (
            <Pressable
              key={v}
              onPress={() => onAmountChange(String(v))}
              style={[
                styles.presetCard,
                active && { borderColor: colors.y, backgroundColor: colors.yl },
              ]}
            >
              <Text style={[styles.presetValue, active && { color: colors.dk }]}>
                {v}
              </Text>
              <Text style={[styles.presetUnit, active && { color: colors.dk }]}>
                {ar ? 'ج.م' : 'EGP'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={colDir}>
        <Text style={[styles.sectionLabel, dirStyle, { marginTop: spacing.md }]}>
          {ar ? 'أو أدخل مبلغاً مخصصاً' : 'Or enter a custom amount'}
        </Text>
      </View>
      <View style={[styles.customAmountWrap, rowDir]}>
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.g400}
          style={styles.customAmountInput}
        />
        <Text style={styles.customAmountSuffix}>{ar ? 'ج.م' : 'EGP'}</Text>
      </View>
      <View style={colDir}>
        <Text style={[styles.helpText, dirStyle, { marginTop: spacing.xs }]}>
          {ar ? `الحد الأدنى ${MIN_AMOUNT} ج.م` : `Minimum is ${MIN_AMOUNT} EGP`}
        </Text>
      </View>

      {amountValid ? (
        <View style={[styles.confirmBanner, rowDir]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
          <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
            <Text style={[styles.confirmBannerText, dirStyle]}>
              {ar
                ? `سيُضاف ${parsedAmount} ج.م إلى رصيد محفظتك`
                : `${parsedAmount} EGP will be added to your wallet`}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={colDir}>
        <Text style={[styles.sectionLabel, dirStyle, { marginTop: spacing.md }]}>
          {t.choosePaymentMethod}
        </Text>
      </View>
      <View style={styles.methodList}>
        {instapayOn ? (
          <MethodCard
            icon="phone-portrait-outline"
            iconColor={'#7B2FBE'}
            title={t.payWithInstapay}
            subtitle={ar ? 'تحويل يدوي + إثبات' : 'Manual transfer + proof'}
            onPress={props.onInstapay}
            disabled={props.busy || !amountValid}
            gradientBg
          />
        ) : null}
      </View>

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'إغلاق' : 'Close'}
            variant="outline"
            size="md"
            onPress={props.onClose}
            disabled={props.busy}
          />
        </View>
      </View>
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
  gradientBg,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle: string
  onPress: () => void
  disabled?: boolean
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
        pressed && !disabled && { opacity: 0.9 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={[styles.methodIconWrap, { backgroundColor: colors.white }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
        <Text style={[styles.methodTitle, dirStyle]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.methodSubtitle, dirStyle]} numberOfLines={2}>{subtitle}</Text>
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
  amount: number
  screenshotKey: string
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
  const { amount } = props

  return (
    <View>
      <InstapayQrCard amount={amount} />

      <View style={{ marginTop: spacing.md }}>
        <PaymentScreenshotUpload
          label={t.uploadScreenshot}
          value={props.screenshotKey}
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

function DonePanel({
  amount,
  onClose,
}: {
  amount: number
  onClose: () => void
}) {
  const { t } = useLocale()
  const { ar } = useDir()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View style={styles.successCircle}>
        <Ionicons name="checkmark" size={40} color={colors.white} />
      </View>
      <Text style={[styles.stepHeading, { marginTop: spacing.md, textAlign: 'center' }]}>
        {t.instapaySubmitted}
      </Text>
      <Text style={[styles.helpText, { textAlign: 'center', marginTop: spacing.sm }]}>
        {ar
          ? `سيقوم فريق Vatix بمراجعة التحويل وإضافة ${amount} ج.م إلى محفظتك خلال 24 ساعة`
          : `The Vatix team will review the transfer and add ${amount} EGP to your wallet within 24 hours.`}
      </Text>
      <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
        <Button
          label={ar ? 'تم' : 'Done'}
          variant="y"
          size="md"
          onPress={onClose}
        />
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
  presetGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  presetCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  presetValue: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
  },
  presetUnit: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  customAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  customAmountInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.dk,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  customAmountSuffix: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g500,
    marginStart: spacing.sm,
  },
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gl,
    borderColor: colors.green,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmBannerText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.green,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
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
    flex: 1,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  ltrValue: {
    letterSpacing: 2,
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
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
})
