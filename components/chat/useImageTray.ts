import { useCallback, useEffect, useRef, useState } from 'react'
import { ActionSheetIOS, Alert, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useLocale } from '@/contexts/locale'
import { isAbortError, uploadAttachment, UploadError } from '@/lib/chat/upload'
import { resizeForUpload } from '@/lib/chat/nativeCaps'
import { MAX_IMAGES_PER_MESSAGE, MAX_IMAGE_BYTES, assetMime, capImages, trayError, trayReady } from '@/lib/chat/images'
import type { ChatAttachment, LocalUpload } from '@/lib/chat/types'

export interface TrayItem {
  key: string
  uri: string
  mime: string
  width: number | null
  height: number | null
  status: 'uploading' | 'done' | 'error'
  progress: number
  attachment: ChatAttachment | null
  /** `tooLarge` cannot be retried (15 MB server limit); `failed` can. */
  error: 'tooLarge' | 'failed' | null
}

export type TrayNotice = 'tooManyImages' | null

export type TrayTake = { caption: string; attachments: ChatAttachment[]; localFiles: LocalUpload[] }

const NOTICE_MS = 3500
const QUALITY = 0.7

/**
 * Image tray for one conversation (mobile port of the website hook): picked images start
 * uploading at once, each with its own progress / abort / retry. Also owns the gallery /
 * camera chooser so the thread screen only wires `openPicker`, `take` and `discard`.
 */
export function useImageTray(conversationId: number) {
  const { t } = useLocale()
  const [items, setItems] = useState<TrayItem[]>([])
  const [caption, setCaptionState] = useState('')
  const [notice, setNotice] = useState<TrayNotice>(null)
  // Source of truth for callbacks that fire before a re-render (upload progress bursts).
  const itemsRef = useRef<TrayItem[]>([])
  const captionRef = useRef('')
  const controllersRef = useRef(new Map<string, AbortController>())
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seqRef = useRef(0)
  const mountedRef = useRef(true)

  const update = useCallback((fn: (prev: TrayItem[]) => TrayItem[]) => {
    const next = fn(itemsRef.current)
    itemsRef.current = next
    if (mountedRef.current) setItems(next)
  }, [])

  const patch = useCallback(
    (key: string, p: Partial<TrayItem>) => {
      update((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)))
    },
    [update],
  )

  const setCaption = useCallback((c: string) => {
    captionRef.current = c
    setCaptionState(c)
  }, [])

  const flashNotice = useCallback((n: Exclude<TrayNotice, null>) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setNotice(n)
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null
      if (mountedRef.current) setNotice(null)
    }, NOTICE_MS)
  }, [])

  const start = useCallback(
    (item: TrayItem) => {
      const controllers = controllersRef.current
      controllers.get(item.key)?.abort()
      const ctrl = new AbortController()
      controllers.set(item.key, ctrl)
      // Downscale to 1600 px first (a no-op on runtimes without expo-image-manipulator); the tray
      // keeps showing the original, only the uploaded bytes shrink.
      resizeForUpload(item.uri, item.mime, item.width, item.height)
        .then((file) => {
          if (controllers.get(item.key) !== ctrl) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
          return uploadAttachment(
            conversationId,
            file.uri,
            file.mime,
            { kind: 'image' },
            (pct) => {
              if (controllers.get(item.key) === ctrl) patch(item.key, { progress: pct })
            },
            ctrl.signal,
          )
        })
        .then((attachment) => {
          if (controllers.get(item.key) !== ctrl) return
          controllers.delete(item.key)
          patch(item.key, { status: 'done', progress: 100, attachment, error: null })
        })
        .catch((err: unknown) => {
          if (isAbortError(err) || controllers.get(item.key) !== ctrl) return
          controllers.delete(item.key)
          patch(item.key, { status: 'error', error: trayError(err instanceof UploadError ? err.status : undefined) })
        })
    },
    [conversationId, patch],
  )

  /** Past 10 the rest is dropped with the `tooManyImages` notice; oversize files fail up front. */
  const add = useCallback(
    (assets: ImagePicker.ImagePickerAsset[]) => {
      const { accepted, overflow } = capImages(assets, itemsRef.current.length)
      if (overflow) flashNotice('tooManyImages')
      if (!accepted.length) return
      const fresh: TrayItem[] = accepted.map((a) => {
        seqRef.current += 1
        const tooLarge = (a.fileSize ?? 0) > MAX_IMAGE_BYTES
        return {
          key: `img-${seqRef.current}`,
          uri: a.uri,
          mime: assetMime(a),
          width: a.width || null,
          height: a.height || null,
          progress: 0,
          attachment: null,
          status: tooLarge ? 'error' : 'uploading',
          error: tooLarge ? 'tooLarge' : null,
        }
      })
      update((prev) => [...prev, ...fresh])
      for (const it of fresh) if (it.status === 'uploading') start(it)
    },
    [flashNotice, start, update],
  )

  /** Removes one image, cancelling its upload if still running. */
  const remove = useCallback(
    (key: string) => {
      controllersRef.current.get(key)?.abort()
      controllersRef.current.delete(key)
      update((prev) => prev.filter((it) => it.key !== key))
      if (itemsRef.current.length === 0) setCaption('')
    },
    [setCaption, update],
  )

  const retry = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((it) => it.key === key)
      if (!item || item.error !== 'failed') return
      const next = { ...item, status: 'uploading' as const, progress: 0, error: null }
      patch(key, next)
      start(next)
    },
    [patch, start],
  )

  /** Aborts every upload and empties the tray. */
  const discard = useCallback(() => {
    controllersRef.current.forEach((c) => c.abort())
    controllersRef.current.clear()
    update(() => [])
    setCaption('')
  }, [setCaption, update])

  /** Hands the uploaded set to the caller and empties the tray; null unless every image is uploaded. */
  const take = useCallback((): TrayTake | null => {
    const list = itemsRef.current
    if (!list.length || !list.every((it) => it.status === 'done' && it.attachment)) return null
    const out: TrayTake = {
      caption: captionRef.current,
      attachments: list.map((it) => it.attachment as ChatAttachment),
      localFiles: list.map((it) => ({
        uri: it.uri,
        mime: it.mime,
        kind: 'image' as const,
        width: it.width ?? undefined,
        height: it.height ?? undefined,
      })),
    }
    update(() => [])
    setCaption('')
    return out
  }, [setCaption, update])

  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t.permissionRequired, t.allowPhotoAccess)
        return
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES_PER_MESSAGE,
        quality: QUALITY,
      })
      if (!res.canceled && res.assets?.length) add(res.assets)
    } catch {
      Alert.alert(t.chat.uploadFailed)
    }
  }, [add, t])

  const pickFromCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t.permissionRequired, t.chat.cameraDenied)
        return
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: QUALITY })
      if (!res.canceled && res.assets?.length) add(res.assets)
    } catch {
      // No camera (simulator) or the picker failed to open: say so instead of crashing.
      Alert.alert(t.permissionRequired, t.chat.cameraDenied)
    }
  }, [add, t])

  /** The ＋ sheet: camera / photo library / cancel. A full tray only shows the notice. */
  const openPicker = useCallback(() => {
    if (itemsRef.current.length >= MAX_IMAGES_PER_MESSAGE) {
      flashNotice('tooManyImages')
      return
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t.chat.attach, options: [t.chat.camera, t.chat.gallery, t.cancel], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) void pickFromCamera()
          else if (i === 1) void pickFromGallery()
        },
      )
      return
    }
    Alert.alert(
      t.chat.attach,
      undefined,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.chat.camera, onPress: () => void pickFromCamera() },
        { text: t.chat.gallery, onPress: () => void pickFromGallery() },
      ],
      { cancelable: true },
    )
  }, [flashNotice, pickFromCamera, pickFromGallery, t])

  // The thread screen is per conversation: unmount is the only teardown needed.
  useEffect(() => {
    mountedRef.current = true
    const controllers = controllersRef.current
    return () => {
      mountedRef.current = false
      controllers.forEach((c) => c.abort())
      controllers.clear()
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  return {
    items,
    caption,
    setCaption,
    notice,
    open: items.length > 0,
    ready: trayReady(items),
    add,
    remove,
    retry,
    take,
    discard,
    openPicker,
  }
}

export type ImageTrayState = ReturnType<typeof useImageTray>
