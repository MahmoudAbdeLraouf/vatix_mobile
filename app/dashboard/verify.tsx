import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import type { OptionalCheck, StoreVerificationView } from '@/lib/api'
import { authErrorMessage, authFetch, authPost, authUploadForm } from '@/lib/auth'

const BASE_PATH = '/stores/me/verification'
const OPTIONAL: OptionalCheck[] = ['commercial_register', 'storefront', 'facebook']
const CR_RE = /^\d{1,20}$/

/** Localizes the Facebook link/code errors from the backend; anything else passes through. */
function fbError(message: string, p: { errWrongFbCode: string; fbCodeExpired: string; errNoFbCode: string; errFbUrl: string }) {
  const raw = message.toLowerCase()
  if (raw === 'wrong code') return p.errWrongFbCode
  if (raw.includes('facebook code has expired')) return p.fbCodeExpired
  if (raw.includes('no facebook code was sent')) return p.errNoFbCode
  if (raw.includes('pageurl must be a url')) return p.errFbUrl
  return message
}

type Msg = { text: string; ok: boolean }

export default function VerifyScreen() {
  const { locale, t } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const v = t.verified
  const p = v.page
  const ar = locale === 'ar'
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const ltrStyle = { textAlign: 'left' as const, writingDirection: 'ltr' as const }

  const [view, setView] = useState<StoreVerificationView | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [codeSent, setCodeSent] = useState<'whatsapp' | 'sms' | null>(null)
  const [otp, setOtp] = useState('')
  const [crNumber, setCrNumber] = useState('')
  const [fbUrl, setFbUrl] = useState('')
  const [fbCode, setFbCode] = useState('')
  const [fbCodeError, setFbCodeError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const applyView = useCallback((next: StoreVerificationView, initial = false) => {
    setView(next)
    setNow(Date.now())
    if (initial || next.request) {
      setCrNumber((c) => c || next.request?.crNumber || '')
      setFbUrl((f) => f || next.request?.facebookPageUrl || next.prefillFacebookUrl || '')
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await authFetch<StoreVerificationView>(BASE_PATH)
      if (!data) {
        setLoadFailed(true)
        return
      }
      setLoadFailed(false)
      applyView(data, true)
    } catch {
      setLoadFailed(true)
    }
  }, [applyView])

  // Refetch whenever the screen regains focus (replaces the mount-only fetch).
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  function retryLoad() {
    setLoadFailed(false)
    load()
  }

  async function run(key: string, fn: () => Promise<StoreVerificationView | null | void>, okText?: string) {
    setBusy(key)
    setMsg(null)
    try {
      const next = await fn()
      if (next) applyView(next)
      if (okText) setMsg({ text: okText, ok: true })
    } catch (err) {
      setMsg({ text: fbError(authErrorMessage(err, t), p) || p.error, ok: false })
    } finally {
      setBusy(null)
    }
  }

  function sendCode() {
    return run('send', async () => {
      const r = await authPost<{ channel: 'whatsapp' | 'sms' }>(`${BASE_PATH}/phone/send`, {})
      setCodeSent(r.channel)
    })
  }

  function checkCode() {
    return run('check', async () => {
      const next = await authPost<StoreVerificationView>(`${BASE_PATH}/phone/check`, { code: otp })
      setOtp('')
      setCodeSent(null)
      return next
    })
  }

  function saveFbLink() {
    return run('fb', () => authPost<StoreVerificationView>(`${BASE_PATH}/facebook`, { pageUrl: fbUrl.trim() }))
  }

  async function confirmFbCode() {
    setBusy('fbConfirm')
    setMsg(null)
    setFbCodeError(null)
    try {
      const next = await authPost<StoreVerificationView>(`${BASE_PATH}/facebook/confirm`, { code: fbCode.trim() })
      setFbCode('')
      applyView(next)
    } catch (err) {
      setFbCodeError(fbError(authErrorMessage(err, t), p) || p.error)
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    setBusy('submit')
    setMsg(null)
    setSubmitError(null)
    try {
      // A typed-but-unsaved Facebook link is saved first so it is part of the submission.
      const pageUrl = fbUrl.trim()
      if (pageUrl && pageUrl !== (view?.request?.facebookPageUrl ?? '')) {
        applyView(await authPost<StoreVerificationView>(`${BASE_PATH}/facebook`, { pageUrl }))
      }
      applyView(await authPost<StoreVerificationView>(`${BASE_PATH}/submit`, {}))
      setMsg({ text: p.submitted, ok: true })
    } catch (err) {
      setSubmitError(fbError(authErrorMessage(err, t), p) || p.error)
    } finally {
      setBusy(null)
    }
  }

  /**
   * Picks an image (camera first when asked and allowed, otherwise the photo
   * library). Camera is skipped on Android and falls back to the library when
   * permission is denied, no camera exists, or launching fails.
   */
  async function pickAsset(preferCamera: boolean): Promise<ImagePicker.ImagePickerAsset | null> {
    if (preferCamera && Platform.OS !== 'android') {
      try {
        const cam = await ImagePicker.requestCameraPermissionsAsync()
        if (cam.granted) {
          const shot = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 })
          if (shot.canceled || !shot.assets?.length) return null
          return shot.assets[0]
        }
      } catch {
        // no camera (simulator) or launch failure: fall through to the library
      }
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t.permissionRequired, t.allowPhotoAccess)
      return null
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return null
    return result.assets[0]
  }

  async function pickAndUpload(
    key: string,
    endpoint: string,
    opts: { preferCamera?: boolean; fields?: Record<string, string> } = {},
  ) {
    let asset: ImagePicker.ImagePickerAsset | null
    try {
      asset = await pickAsset(!!opts.preferCamera)
    } catch (err) {
      setMsg({ text: authErrorMessage(err, t) || p.error, ok: false })
      return
    }
    if (!asset) return
    const picked = asset
    await run(key, async () => {
      const fd = new FormData()
      fd.append('file', {
        uri: picked.uri,
        type: picked.mimeType ?? 'image/jpeg',
        name: 'upload.jpg',
      } as unknown as Blob)
      for (const [k, val] of Object.entries(opts.fields ?? {})) fd.append(k, val)
      const { status, body } = await authUploadForm(`${BASE_PATH}${endpoint}`, fd)
      if (status < 200 || status >= 300) {
        const m = body?.message
        throw new Error((Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : '') || p.error)
      }
      return body as StoreVerificationView
    })
  }

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  function renderBody(view: StoreVerificationView) {
    const req = view.request
    const status = req?.status ?? null
    const pending = status === 'pending'
    const draft = status === 'draft'
    const verified = view.verification.verified
    const carried = req?.carriedChecks ?? []

    const accepted = (c: OptionalCheck) =>
      carried.includes(c) ||
      (status === 'rejected' && req?.results[c]?.result === 'pass') ||
      (verified && view.verification.checks.includes(c))

    const hasData: Record<OptionalCheck, boolean> = {
      commercial_register: !!req?.hasCrPhoto && !!req.crNumber,
      storefront: !!req?.hasSignPhoto,
      // A typed link counts too: submit saves it before sending.
      facebook: !!req?.facebookPageUrl || !!fbUrl.trim(),
    }
    const provided = OPTIONAL.filter((c) => hasData[c] && !carried.includes(c))
    const total = OPTIONAL.filter((c) => accepted(c) || provided.includes(c)).length

    const fbExpiresAt = req?.facebookCodeExpiresAt ?? null
    const fbExpired = !!fbExpiresAt && new Date(fbExpiresAt).getTime() < now

    const blocker = !draft
      ? p.needNew
      : !view.phone.verified
        ? p.needPhone
        : provided.length < 1
          ? p.needNew
          : total < 2
            ? p.needTwo
            : null
    const canSubmit = blocker === null

    const verifiedIdle = verified && !draft && !pending && !showAdd
    const canAdd = verifiedIdle && OPTIONAL.some((c) => !accepted(c))
    const showInputs = !pending && !verifiedIdle

    const failReason = (c: OptionalCheck): string | null =>
      status === 'rejected' && req?.results[c]?.result === 'fail'
        ? req.results[c]?.reason?.trim() || '—'
        : null

    const crValid = CR_RE.test(crNumber)
    const crDirty = !!req?.hasCrPhoto && !!req.crNumber && req.crNumber !== crNumber
    const anyBusy = busy !== null

    const card = (c: OptionalCheck, children: React.ReactNode, pendingExtra?: React.ReactNode) => {
      const reason = failReason(c)
      return (
        <View style={[styles.card, !isDark && shadow.ss]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, dirStyle]}>{v.labels[c]}</Text>
            {accepted(c) ? (
              <View style={styles.pillOk}>
                <Text style={styles.pillOkText}>✓ {p.accepted}</Text>
              </View>
            ) : pending && hasData[c] ? (
              <View style={styles.pillWait}>
                <Text style={styles.pillWaitText}>{p.pendingTitle}</Text>
              </View>
            ) : null}
          </View>
          {reason ? (
            <View style={styles.reasonBox}>
              <Text style={[styles.reasonText, dirStyle]}>
                {p.reasonLabel}: {reason}
              </Text>
            </View>
          ) : null}
          {accepted(c) ? null : pending ? (
            hasData[c] ? (
              (pendingExtra ?? null)
            ) : (
              <Text style={[styles.hint, dirStyle]}>{p.notSubmittedYet}</Text>
            )
          ) : showInputs ? (
            children
          ) : null}
        </View>
      )
    }

    const photoField = (opts: {
      key: string
      label: string
      hint: string
      uploaded: boolean
      disabled?: boolean
      endpoint: string
      fields?: Record<string, string>
      preferCamera?: boolean
    }) => (
      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{opts.label}</Text>
        <Button
          label={opts.uploaded ? p.replacePhoto : p.choosePhoto}
          variant="outline"
          size="md"
          loading={busy === opts.key}
          disabled={opts.disabled || anyBusy}
          leftIcon={<Ionicons name="camera-outline" size={18} color={colors.heading} />}
          onPress={() =>
            pickAndUpload(opts.key, opts.endpoint, { fields: opts.fields, preferCamera: opts.preferCamera })
          }
        />
        {opts.uploaded ? (
          <View style={styles.uploadedRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.green} />
            <Text style={[styles.uploadedText, dirStyle]}>{p.photoUploaded}</Text>
          </View>
        ) : null}
        <Text style={[styles.hint, dirStyle]}>{opts.hint}</Text>
      </View>
    )

    return (
      <View style={[styles.body, dirContainer]}>
        {verified ? (
          <View style={[styles.card, !isDark && shadow.ss]}>
            <Text style={[styles.cardTitle, dirStyle]}>{p.verifiedTitle}</Text>
            <VerifiedBadge verification={view.verification} variant="full" />
            {canAdd ? (
              <Button
                label={p.addCheck}
                variant="outline"
                size="sm"
                fullWidth={false}
                style={styles.alignStart}
                onPress={() => setShowAdd(true)}
              />
            ) : null}
          </View>
        ) : null}

        {pending ? (
          <View style={styles.pendingCard}>
            <Text style={[styles.pendingTitle, dirStyle]}>⏳ {p.pendingTitle}</Text>
            <Text style={[styles.bodyText, dirStyle]}>{p.pendingBody}</Text>
          </View>
        ) : null}

        {status === 'rejected' ? (
          <View style={styles.rejectedCard}>
            <Text style={[styles.rejectedTitle, dirStyle]}>{p.rejectedTitle}</Text>
            <Text style={[styles.bodyText, dirStyle]}>{p.rejectedBody}</Text>
          </View>
        ) : null}

        {!verified && !pending ? <Text style={[styles.bodyText, dirStyle]}>{p.intro}</Text> : null}
        <Text style={[styles.rule, dirStyle]}>{p.rule}</Text>

        <View style={[styles.card, !isDark && shadow.ss]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, dirStyle]}>{v.labels.phone}</Text>
            {view.phone.verified ? (
              <View style={styles.pillOk}>
                <Text style={styles.pillOkText}>✓ {p.phoneDone}</Text>
              </View>
            ) : null}
          </View>
          {!view.phone.verified && !pending ? (
            <>
              <Text style={[styles.bodyText, dirStyle]}>
                {p.phoneNeeded} <Text style={[styles.maskedPhone, ltrStyle]}>{view.phone.masked}</Text>
              </Text>
              {codeSent === null ? (
                <Button
                  label={busy === 'send' ? '...' : p.sendCode}
                  variant="y"
                  size="md"
                  fullWidth={false}
                  style={styles.alignStart}
                  disabled={anyBusy}
                  onPress={sendCode}
                />
              ) : (
                <View style={styles.otpWrap}>
                  <View style={styles.channelHint}>
                    <Text style={styles.channelIcon}>💬</Text>
                    <Text style={[styles.channelText, dirStyle]}>
                      {codeSent === 'whatsapp' ? p.whatsappHint : p.smsHint}
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={otp}
                    onChangeText={(x) => setOtp(x.replace(/\D/g, '').slice(0, 6))}
                    placeholder={p.codePlaceholder}
                    placeholderTextColor={colors.subtle}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textContentType="oneTimeCode"
                  />
                  <Button
                    label={busy === 'check' ? '...' : p.confirmCode}
                    variant="y"
                    size="md"
                    disabled={otp.length !== 6 || anyBusy}
                    onPress={checkCode}
                  />
                  <Pressable onPress={sendCode} disabled={anyBusy} hitSlop={8}>
                    <Text style={[styles.link, dirStyle]}>{p.resendCode}</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : null}
        </View>

        {!verifiedIdle || accepted('commercial_register')
          ? card(
              'commercial_register',
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, dirStyle]}>{p.crNumber}</Text>
                  <TextInput
                    style={[styles.input, ltrStyle]}
                    value={crNumber}
                    onChangeText={(x) => setCrNumber(x.replace(/\D/g, '').slice(0, 20))}
                    keyboardType="number-pad"
                    maxLength={20}
                    placeholderTextColor={colors.subtle}
                  />
                  <Text style={[styles.hint, dirStyle]}>{p.crNumberHint}</Text>
                </View>
                {photoField({
                  key: 'cr',
                  label: p.crPhoto,
                  hint: crValid ? (crDirty ? p.crNumberChanged : p.photoHint) : p.crNeedNumber,
                  uploaded: !!req?.hasCrPhoto,
                  disabled: !crValid,
                  endpoint: '/cr',
                  fields: { crNumber },
                })}
              </>,
            )
          : null}

        {!verifiedIdle || accepted('storefront')
          ? card(
              'storefront',
              <>
                <Text style={[styles.signLine, dirStyle]}>{p.signLine}</Text>
                {photoField({
                  key: 'sign',
                  label: p.signPhoto,
                  hint: p.photoHint,
                  uploaded: !!req?.hasSignPhoto,
                  endpoint: '/sign',
                  preferCamera: true,
                })}
              </>,
            )
          : null}

        {!verifiedIdle || accepted('facebook')
          ? card(
              'facebook',
              <>
                <Text style={[styles.bodyText, dirStyle]}>
                  {p.fbPhoneRule} <Text style={[styles.maskedPhone, ltrStyle]}>{view.phone.masked}</Text>
                </Text>
                <Text style={[styles.hint, dirStyle]}>{p.fbFallback}</Text>
                <View style={styles.field}>
                  <Text style={[styles.label, dirStyle]}>{p.fbPageUrl}</Text>
                  <TextInput
                    style={[styles.input, ltrStyle]}
                    value={fbUrl}
                    onChangeText={(text) => { setFbUrl(text); setSubmitError(null) }}
                    placeholder="https://facebook.com/your-shop"
                    placeholderTextColor={colors.subtle}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {req?.facebookPageUrl && req.facebookPageUrl === fbUrl.trim() ? (
                  <View style={styles.uploadedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                    <Text style={[styles.uploadedText, dirStyle]}>{p.linkSaved}</Text>
                  </View>
                ) : (
                  <Button
                    label={busy === 'fb' ? '...' : p.saveLink}
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    style={styles.alignStart}
                    disabled={anyBusy || !fbUrl.trim()}
                    onPress={saveFbLink}
                  />
                )}
              </>,
              req?.facebookCodeConfirmed ? (
                <View style={[styles.pillOk, styles.alignStart]}>
                  <Text style={styles.pillOkText}>✓ {p.fbCodeConfirmed}</Text>
                </View>
              ) : req?.facebookCodeSent ? (
                fbExpired ? (
                  <Text style={[styles.codeExpired, dirStyle]}>{p.fbCodeExpired}</Text>
                ) : (
                  <View style={styles.codeBox}>
                    <Text style={[styles.bodyText, dirStyle]}>{p.fbCodeSent}</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      value={fbCode}
                      onChangeText={(x) => {
                        setFbCode(x.toUpperCase())
                        setFbCodeError(null)
                      }}
                      placeholder="VTX-XXXXXX"
                      placeholderTextColor={colors.subtle}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={16}
                    />
                    {fbCodeError ? <Text style={[styles.codeExpired, dirStyle]}>{fbCodeError}</Text> : null}
                    <Button
                      label={busy === 'fbConfirm' ? '...' : p.confirmCode}
                      variant="y"
                      size="md"
                      disabled={anyBusy || fbCode.trim().length < 4}
                      onPress={confirmFbCode}
                    />
                    {fbExpiresAt ? (
                      <Text style={[styles.hint, dirStyle]}>
                        {p.expiresOn} {dateFmt(fbExpiresAt)}
                      </Text>
                    ) : null}
                  </View>
                )
              ) : null,
            )
          : null}

        {showInputs ? (
          <View style={styles.submitWrap}>
            <Button
              label={busy === 'submit' ? p.submitting : p.submit}
              variant="y"
              size="lg"
              disabled={!canSubmit || anyBusy}
              onPress={submit}
            />
            {submitError ? (
              <Text style={[styles.hint, dirStyle, { color: colors.red }]}>{submitError}</Text>
            ) : blocker ? (
              <Text style={[styles.hint, dirStyle]}>{blocker}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <DashboardLayout title={p.title}>
      <View style={[styles.wrap, dirContainer]}>
        <Text style={[styles.heading, dirStyle]}>{p.title}</Text>
        {msg ? (
          <View style={[styles.banner, msg.ok ? styles.bannerOk : styles.bannerErr]}>
            <Ionicons
              name={msg.ok ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={msg.ok ? colors.green : colors.red}
            />
            <Text style={[styles.bannerText, { color: msg.ok ? colors.green : colors.red }, dirStyle]}>
              {msg.text}
            </Text>
          </View>
        ) : null}
        {loadFailed ? (
          <ErrorState kind="generic" title={p.loadError} subtitle="" retryLabel={p.retry} onRetry={retryLoad} />
        ) : !view ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.y} />
            <Text style={[styles.hint, dirStyle]}>{p.loading}</Text>
          </View>
        ) : (
          renderBody(view)
        )}
      </View>
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: spacing.md },
    body: { gap: spacing.md },
    heading: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.heading },
    loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm + 4,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    bannerOk: { backgroundColor: colors.greenBg, borderColor: colors.green },
    bannerErr: { backgroundColor: colors.redBg, borderColor: colors.red },
    bannerText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 20 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm + 4,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardTitle: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.heading },
    pillOk: {
      backgroundColor: colors.greenBg,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    pillOkText: { fontFamily: fonts.bold, fontSize: 12, color: colors.green },
    pillWait: {
      backgroundColor: colors.yl,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    pillWaitText: { fontFamily: fonts.bold, fontSize: 12, color: colors.yd },
    reasonBox: {
      backgroundColor: colors.redBg,
      borderRadius: radius.sm,
      padding: spacing.sm + 2,
    },
    reasonText: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 20, color: colors.red },
    pendingCard: {
      backgroundColor: colors.yl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.y,
      padding: spacing.md,
      gap: spacing.xs,
    },
    pendingTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.dk },
    rejectedCard: {
      backgroundColor: colors.redBg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.red,
      padding: spacing.md,
      gap: spacing.xs,
    },
    rejectedTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.red },
    bodyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.text },
    rule: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.heading },
    maskedPhone: { fontFamily: fonts.bold, color: colors.heading },
    signLine: { fontFamily: fonts.bold, fontSize: 14, color: colors.heading },
    field: { gap: spacing.xs + 2 },
    label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
    hint: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, color: colors.muted },
    input: {
      height: 52,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: colors.text,
    },
    otpWrap: { gap: spacing.sm + 4 },
    otpInput: {
      fontFamily: fonts.bold,
      fontSize: 20,
      letterSpacing: 8,
      textAlign: 'center',
    },
    channelHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm + 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.green,
      backgroundColor: colors.greenBg,
    },
    channelIcon: { fontSize: 18 },
    channelText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text },
    link: { fontFamily: fonts.bold, fontSize: 13, color: colors.yd },
    uploadedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    uploadedText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.green },
    codeBox: {
      gap: spacing.xs + 2,
      backgroundColor: colors.inputBg,
      borderRadius: radius.md,
      padding: spacing.sm + 4,
    },
    codeInput: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: 2, textAlign: 'left', writingDirection: 'ltr' },
    codeExpired: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
    alignStart: { alignSelf: 'flex-start' },
    submitWrap: { gap: spacing.sm },
  })
