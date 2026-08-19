import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
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

interface Props {
  label: string
  value: string // opaque object key (empty string = none uploaded)
  onChange: (key: string) => void
  hint?: string
  aspect?: 'square' | 'wide'
  style?: ViewStyle
}

export function PaymentScreenshotUpload({ label, value, onChange, hint, aspect = 'wide', style }: Props) {
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

      const res = await fetch(`${BASE}/user/upload/payment-screenshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Client-Platform': 'mobile' },
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = Array.isArray(data.message) ? data.message.join('، ') : data.message
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
