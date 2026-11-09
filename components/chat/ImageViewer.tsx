import React, { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useLocale } from '@/contexts/locale'
import { fonts } from '@/constants/theme'
import type { GridSource } from '@/lib/chat/images'

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 800

type Props = {
  sources: GridSource[]
  /** Index to open at; null = closed. */
  index: number | null
  onClose: () => void
}

function ZoomablePage({
  source,
  width,
  height,
  dismissY,
  onZoomChange,
  onClose,
}: {
  source: GridSource
  width: number
  height: number
  dismissY: SharedValue<number>
  onZoomChange: (zoomed: boolean) => void
  onClose: () => void
}) {
  const [zoomed, setZoomed] = useState(false)
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)

  const reportZoom = useCallback(
    (z: boolean) => {
      setZoomed(z)
      onZoomChange(z)
    },
    [onZoomChange],
  )

  const gesture = useMemo(() => {
    // Keeps the scaled image from being dragged past its own edges.
    const clampX = (x: number, s: number) => {
      'worklet'
      const max = ((s - 1) * width) / 2
      return Math.min(max, Math.max(-max, x))
    }
    const clampY = (y: number, s: number) => {
      'worklet'
      const max = ((s - 1) * height) / 2
      return Math.min(max, Math.max(-max, y))
    }
    const reset = () => {
      'worklet'
      scale.value = withTiming(1)
      savedScale.value = 1
      tx.value = withTiming(0)
      ty.value = withTiming(0)
      savedTx.value = 0
      savedTy.value = 0
      runOnJS(reportZoom)(false)
    }

    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale))
      })
      .onEnd(() => {
        if (scale.value <= 1.01) {
          reset()
          return
        }
        savedScale.value = scale.value
        tx.value = withTiming(clampX(tx.value, scale.value))
        ty.value = withTiming(clampY(ty.value, scale.value))
        savedTx.value = clampX(tx.value, scale.value)
        savedTy.value = clampY(ty.value, scale.value)
        runOnJS(reportZoom)(true)
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(250)
      .onEnd((e, success) => {
        if (!success) return
        if (savedScale.value > 1) {
          reset()
          return
        }
        // Zoom in around the tapped point.
        const s = DOUBLE_TAP_SCALE
        const x = clampX((width / 2 - e.x) * (s - 1), s)
        const y = clampY((height / 2 - e.y) * (s - 1), s)
        scale.value = withTiming(s)
        savedScale.value = s
        tx.value = withTiming(x)
        ty.value = withTiming(y)
        savedTx.value = x
        savedTy.value = y
        runOnJS(reportZoom)(true)
      })

    const pan = zoomed
      ? Gesture.Pan()
          .averageTouches(true)
          .onUpdate((e) => {
            tx.value = clampX(savedTx.value + e.translationX, scale.value)
            ty.value = clampY(savedTy.value + e.translationY, scale.value)
          })
          .onEnd(() => {
            savedTx.value = tx.value
            savedTy.value = ty.value
          })
      : // Not zoomed: only a vertical drag is ours (swipe down to close); horizontal goes to the pager.
        Gesture.Pan()
          .activeOffsetY([-12, 12])
          .failOffsetX([-12, 12])
          .onUpdate((e) => {
            dismissY.value = Math.max(0, e.translationY)
          })
          .onEnd((e) => {
            if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
              runOnJS(onClose)()
              return
            }
            dismissY.value = withSpring(0, { damping: 20, stiffness: 220 })
          })

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))
  }, [zoomed, width, height, dismissY, onClose, reportZoom, scale, savedScale, tx, ty, savedTx, savedTy])

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + dismissY.value },
      { scale: scale.value * interpolate(dismissY.value, [0, height], [1, 0.8], 'clamp') },
    ],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }} collapsable={false}>
        <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
          <Image
            source={source.full}
            placeholder={source.thumb}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

/**
 * Full-screen image viewer: horizontal pager, pinch / double-tap zoom, swipe down to close.
 * Images reuse the grid cache keys, so reopening never re-downloads.
 */
export function ImageViewer({ sources, index, onClose }: Props) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [current, setCurrent] = useState(index ?? 0)
  const [zoomed, setZoomed] = useState(false)
  const dismissY = useSharedValue(0)
  const listRef = useRef<FlatList<GridSource>>(null)
  const visible = index !== null && sources.length > 0

  const onShow = useCallback(() => {
    dismissY.value = 0
    setZoomed(false)
    setCurrent(index ?? 0)
  }, [dismissY, index])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, height * 0.6], [1, 0.2], 'clamp'),
  }))
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, 80], [1, 0], 'clamp'),
  }))

  const renderItem = useCallback(
    ({ item }: { item: GridSource }) => (
      <ZoomablePage
        source={item}
        width={width}
        height={height}
        dismissY={dismissY}
        onZoomChange={setZoomed}
        onClose={onClose}
      />
    ),
    [width, height, dismissY, onClose],
  )

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onShow={onShow} onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <FlatList
          ref={listRef}
          data={sources}
          keyExtractor={(s) => s.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(index ?? 0, sources.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialNumToRender={1}
          windowSize={3}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        />
        <Animated.View
          pointerEvents="box-none"
          style={[styles.chrome, { paddingTop: insets.top + 8 }, chromeStyle]}
        >
          {sources.length > 1 ? (
            <Text style={styles.counter}>
              {Math.min(current, sources.length - 1) + 1} / {sources.length}
            </Text>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.close}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
  chrome: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
    writingDirection: 'ltr',
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
})
