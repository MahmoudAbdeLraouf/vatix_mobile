import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as Sentry from '@sentry/react-native'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { authErrorMessage, getToken } from '@/lib/auth'
import { Button } from './Button'

// Mirrors vatix_website/components/payment-screenshot-field.tsx.
// Uploads to the PRIVATE MinIO prefix via POST /user/upload/payment-screenshot
// and stores the returned opaque object key. Preview uses the local picker URI
// because private keys are not directly fetchable — reads happen server-side
// via short-lived presigned GET.

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'
const CLIENT_PLATFORM = Platform.OS

interface Props {
  label: string
  value: string // opaque object key (empty string = none uploaded)
  onChange: (key: string) => void
  hint?: string
  aspect?: 'square' | 'wide'
  style?: ViewStyle
  // Breadcrumb tag so we can tell wallet-topup vs promotion vs subscription
  // failures apart in Sentry without diffing screen names.
  context?: string
}

export function PaymentScreenshotUpload({ label, value, onChange, hint, aspect = 'wide', style, context }: Props) {
  const { locale, t } = useLocale()
  const ar = locale === 'ar'
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUri, setPreviewUri] = useState('')

  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const colDir = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t.permissionRequired, t.allowPhotoAccess)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return

    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    setUploading(true)
    setError('')

    // Diagnostic: wallet-topup + promotion uploads fail on Android with
    // `TypeError: Network request failed` while the store-subscription flow
    // (same component, same props, same endpoint) succeeds. Raw fetch()
    // otherwise produces zero Sentry breadcrumbs, leaving us blind to the
    // native reason. Remove once the Android delta is identified.
    const assetShape = {
      uriScheme: asset.uri?.split(':')[0] ?? null,
      hasFileName: !!asset.fileName,
      mimeType,
      width: asset.width,
      height: asset.height,
      fileSize: (asset as { fileSize?: number }).fileSize ?? null,
    }
    Sentry.addBreadcrumb({
      category: 'upload',
      level: 'info',
      message: '[screenshot-upload] picked',
      data: { context: context ?? null, platform: CLIENT_PLATFORM, ...assetShape },
    })

    try {
      const token = await getToken()
      if (!token) {
        setError(t.sessionExpiredLogIn)
        return
      }
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName ?? 'screenshot.jpg',
      } as unknown as Blob)

      const startedAt = Date.now()
      let res: Response
      try {
        res = await fetch(`${BASE}/user/upload/payment-screenshot`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'X-Client-Platform': CLIENT_PLATFORM },
          body: formData,
        })
      } catch (e) {
        const errObj = e as Error & { cause?: unknown }
        const details = {
          context: context ?? null,
          platform: CLIENT_PLATFORM,
          url: `${BASE}/user/upload/payment-screenshot`,
          elapsedMs: Date.now() - startedAt,
          name: errObj?.name ?? 'Error',
          message: errObj?.message ?? String(e),
          cause: errObj?.cause == null ? undefined : String(errObj.cause),
          ownProps: e && typeof e === 'object' ? Object.getOwnPropertyNames(e) : undefined,
          ...assetShape,
        }
        // eslint-disable-next-line no-console
        console.log('[screenshot-upload] NETWORK FAIL', details)
        Sentry.captureMessage('[screenshot-upload] NETWORK FAIL', {
          level: 'warning',
          tags: { kind: 'network-fail', method: 'POST', context: context ?? 'unknown', uploadKind: 'payment-screenshot' },
          extra: details,
        })
        throw e
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = Array.isArray(data.message) ? data.message.join('، ') : data.message
        Sentry.captureMessage('[screenshot-upload] HTTP FAIL', {
          level: 'warning',
          tags: { kind: 'http-fail', context: context ?? 'unknown', uploadKind: 'payment-screenshot' },
          extra: { context: context ?? null, platform: CLIENT_PLATFORM, status: res.status, body: data, ...assetShape },
        })
        throw new Error(msg ?? t.uploadFailed)
      }
      const { key } = (await res.json()) as { key: string }
      setPreviewUri(asset.uri)
      onChange(key)
    } catch (err: unknown) {
      setError(authErrorMessage(err, t))
    } finally {
      setUploading(false)
    }
  }

  function clear() {
    setPreviewUri('')
    onChange('')
  }

  const previewW = aspect === 'wide' ? 140 : 64
  const previewRadius = aspect === 'wide' ? radius.sm : radius.md

  const chooseLabel = uploading
    ? ar ? 'جاري الرفع...' : 'Uploading...'
    : value
      ? ar ? 'تغيير الصورة' : 'Change'
      : ar ? '+ اختر صورة' : '+ Choose image'

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <View style={colDir}>
          <Text style={[styles.label, dirStyle]}>{label}</Text>
        </View>
      ) : null}

      <View style={[styles.row, rowDir]}>
        <View
          style={[
            styles.preview,
            { width: previewW, borderRadius: previewRadius },
          ]}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              contentFit="cover"
              transition={150}
            />
          ) : value ? (
            <Text style={styles.previewCheck}>✓</Text>
          ) : (
            <Text style={styles.previewPlaceholder}>🖼</Text>
          )}
          {uploading ? (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color={colors.dk} />
            </View>
          ) : null}
        </View>

        <View style={[styles.controls, colDir]}>
          <Button
            label={chooseLabel}
            variant="outline"
            size="sm"
            fullWidth={false}
            loading={uploading}
            onPress={pick}
            disabled={uploading}
            style={styles.chooseBtn}
          />
          {hint ? <Text style={[styles.hint, dirStyle]}>{hint}</Text> : null}
          {value && !uploading ? (
            <Pressable
              onPress={clear}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={ar ? 'حذف الصورة' : 'Remove image'}
            >
              <Text style={[styles.deleteText, dirStyle]}>{ar ? 'حذف الصورة' : 'Remove image'}</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={[styles.errorText, dirStyle]}>⚠️ {error}</Text> : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  preview: {
    height: 64,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.g100,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewPlaceholder: {
    fontSize: 22,
    opacity: 0.25,
  },
  previewCheck: {
    fontSize: 22,
    color: colors.green,
    fontFamily: fonts.bold,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flex: 1,
  },
  chooseBtn: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g400,
    lineHeight: 16,
  },
  deleteText: {
    marginTop: 5,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.red,
  },
  errorText: {
    marginTop: 5,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.red,
  },
})
