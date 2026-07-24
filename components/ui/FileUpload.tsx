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
import { authUploadFile } from '@/lib/auth'
import { Button } from './Button'

// Mirrors vatix_website/components/file-upload-field.tsx.
// Single-file upload with preview thumb + change/delete controls.
// Multipart POST delegated to authUploadFile() in lib/auth.ts.

interface Props {
  label: string
  value: string // current URL (empty string = no image)
  onChange: (url: string) => void
  hint?: string
  aspect?: 'square' | 'wide' // 'square' → 64×64, 'wide' → 140×64
  style?: ViewStyle
}

export function FileUpload({ label, value, onChange, hint, aspect = 'square', style }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Canonical UpgradeModal / settings.tsx RTL pattern. Under inherited RTL,
  // `textAlign: 'right'` and `flexDirection: 'row-reverse'` visually invert
  // (double-flip). `rowDir` forces LTR + reversed row so the first child
  // anchors to the physical right; `colDir` restores RTL context so nested
  // Text uses `textAlign: 'auto'` = start = physical right.
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
      Alert.alert(
        ar ? 'الأذونات مطلوبة' : 'Permission required',
        ar ? 'يرجى السماح بالوصول إلى الصور' : 'Please allow access to your photo library',
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return

    const asset = result.assets[0]
    setUploading(true)
    setError('')
    try {
      const url = await authUploadFile(asset.uri, asset.mimeType ?? 'image/jpeg')
      if (!url) {
        setError(ar ? 'فشل رفع الملف' : 'Upload failed')
        return
      }
      onChange(url)
    } catch {
      setError(ar ? 'فشل رفع الملف' : 'Upload failed')
    } finally {
      setUploading(false)
    }
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
      <View style={colDir}>
        <Text style={[styles.label, dirStyle]}>{label}</Text>
      </View>

      <View style={[styles.row, rowDir]}>
        <View
          style={[
            styles.preview,
            { width: previewW, borderRadius: previewRadius },
          ]}
        >
          {value ? (
            <Image
              source={{ uri: value }}
              style={styles.previewImage}
              contentFit="cover"
              transition={150}
            />
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
              onPress={() => onChange('')}
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
  // Mirrors website preview: 1.5px g200 border, g100 bg, overflow hidden
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
