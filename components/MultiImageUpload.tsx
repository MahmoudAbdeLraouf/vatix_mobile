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
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { authUploadFile } from '@/lib/auth'

// Mirrors vatix_website/components/multi-image-upload.tsx.
// Add placeholders immediately, upload in parallel, replace with real URLs
// (or drop failed ones). First image is the "main" image.

export const MAX_IMAGES = 8

export interface ImageItem {
  url: string
  uploading?: boolean
}

interface Props {
  images: ImageItem[]
  onChange: (
    images: ImageItem[] | ((prev: ImageItem[]) => ImageItem[]),
  ) => void
  style?: ViewStyle
}

const FAILED = '__FAILED__'

export function MultiImageUpload({ images, onChange, style }: Props) {
  const { locale, t } = useLocale()
  const ar = locale === 'ar'
  const [error, setError] = useState('')
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }

  async function pick() {
    if (images.length >= MAX_IMAGES) return

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t.permissionRequired, t.allowPhotoAccess)
      return
    }

    const remaining = MAX_IMAGES - images.length
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return

    const assets = result.assets.slice(0, remaining)
    const startIdx = images.length
    const placeholders: ImageItem[] = assets.map(() => ({ url: '', uploading: true }))
    onChange([...images, ...placeholders])
    setError('')

    const results = await Promise.all(
      assets.map(async (asset, i) => {
        try {
          const url = await authUploadFile(asset.uri, asset.mimeType ?? 'image/jpeg')
          return { index: startIdx + i, url: url ?? '' }
        } catch {
          return { index: startIdx + i, url: '' }
        }
      }),
    )

    onChange((prev) => {
      const next = [...prev]
      for (const { index, url } of results) {
        next[index] = { url: url || FAILED }
      }
      return next.filter((img) => img.url && img.url !== FAILED)
    })

    if (results.some((r) => !r.url)) {
      setError(t.someImagesFailedUpload)
    }
  }

  function remove(idx: number) {
    onChange((prev) => prev.filter((_, i) => i !== idx))
  }

  function move(idx: number, dir: -1 | 1) {
    onChange((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const canAdd = images.length < MAX_IMAGES
  const uploadedCount = images.filter((i) => !i.uploading).length

  return (
    <View style={style}>
      <View style={styles.grid}>
        {images.map((img, i) => (
          <View key={`${i}-${img.url || 'ph'}`} style={styles.tile}>
            {img.uploading ? (
              <View style={styles.tilePlaceholder}>
                <ActivityIndicator color={colors.dk} />
              </View>
            ) : (
              <>
                <Image
                  source={{ uri: img.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
                {i === 0 ? (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>
                      {ar ? 'رئيسية' : 'Main'}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => remove(i)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.removeBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={ar ? 'حذف الصورة' : 'Remove image'}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
                <View style={styles.reorderRow}>
                  <Pressable
                    disabled={i === 0}
                    onPress={() => move(i, -1)}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.reorderBtn,
                      i === 0 && styles.reorderBtnDisabled,
                      pressed && i !== 0 && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={ar ? 'إلى الأمام' : 'Move earlier'}
                  >
                    <Ionicons
                      name={ar ? 'chevron-forward' : 'chevron-back'}
                      size={12}
                      color={colors.white}
                    />
                  </Pressable>
                  <Pressable
                    disabled={i === images.length - 1}
                    onPress={() => move(i, 1)}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.reorderBtn,
                      i === images.length - 1 && styles.reorderBtnDisabled,
                      pressed && i !== images.length - 1 && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={ar ? 'إلى الخلف' : 'Move later'}
                  >
                    <Ionicons
                      name={ar ? 'chevron-back' : 'chevron-forward'}
                      size={12}
                      color={colors.white}
                    />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ))}

        {canAdd ? (
          <Pressable
            onPress={pick}
            style={({ pressed }) => [
              styles.tile,
              styles.addTile,
              pressed && { backgroundColor: colors.yl, borderColor: colors.y },
            ]}
            accessibilityRole="button"
            accessibilityLabel={ar ? 'إضافة صورة' : 'Add image'}
          >
            <Ionicons name="camera-outline" size={24} color={colors.g400} />
            <Text style={styles.addText}>{ar ? '+ إضافة' : '+ Add'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.hintRow}>
        <Text style={[styles.hintText, styles.hintTextFlex, dirStyle]}>
          {uploadedCount} / {MAX_IMAGES}{' '}
          {ar ? 'صورة · الصورة الأولى هي الرئيسية' : 'images · first image is the main'}
        </Text>
        <Text style={[styles.hintText, dirStyle]}>
          {ar ? 'JPG · PNG · WebP · أقل من 5 MB' : 'JPG · PNG · WebP · under 5 MB'}
        </Text>
      </View>

      {error ? (
        <Text style={[styles.errorText, dirStyle]}>
          ⚠️ {error}
        </Text>
      ) : null}
    </View>
  )
}

const TILE_SIZE = 100

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.g200,
    backgroundColor: colors.g100,
    position: 'relative',
  },
  tilePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.g100,
  },
  addTile: {
    borderStyle: 'dashed',
    borderColor: colors.g300,
    backgroundColor: colors.g50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.g500,
  },
  mainBadge: {
    position: 'absolute',
    bottom: 4,
    end: 4,
    backgroundColor: colors.y,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    fontFamily: fonts.black,
    fontSize: 9,
    color: colors.dk,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    start: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderRow: {
    position: 'absolute',
    top: 4,
    end: 4,
    flexDirection: 'row',
    gap: 4,
  },
  reorderBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  hintText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g400,
  },
  hintTextFlex: {
    flex: 1,
  },
  errorText: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.red,
  },
})
