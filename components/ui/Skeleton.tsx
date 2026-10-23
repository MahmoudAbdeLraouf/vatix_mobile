import { useEffect, useRef } from 'react'
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native'
import { colors, radius, spacing } from '@/constants/theme'

interface SkeletonProps {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  style?: ViewStyle | ViewStyle[]
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius: r = radius.sm,
  style,
}: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] })

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: colors.g200,
          opacity,
        },
        style as ViewStyle,
      ]}
    />
  )
}

export function SkeletonCard() {
  return (
    <View style={s.card}>
      <Skeleton height={140} radius={12} />
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={12} width="40%" />
        <Skeleton height={18} width="35%" />
      </View>
    </View>
  )
}

export function SkeletonRow() {
  return (
    <View style={s.row}>
      <Skeleton width={56} height={56} radius={12} />
      <View style={{ flex: 1, gap: spacing.xs, marginStart: spacing.md }}>
        <Skeleton height={14} width="60%" />
        <Skeleton height={12} width="40%" />
      </View>
    </View>
  )
}

// Placeholder that mirrors ProductCard's `row` variant (128px image column,
// title/category/store/price stack) so blank list areas read as rows still
// loading. One pulse per row instead of one per bar keeps it cheap to stack.
export function SkeletonProductRow() {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })

  return (
    <View style={s.productRow}>
      <View style={s.productImageWrap}>
        <Animated.View style={[s.productImage, { opacity }]} />
      </View>
      <Animated.View style={[s.productInfo, { opacity }]}>
        <View style={[s.bar, { height: 14, width: '85%' }]} />
        <View style={[s.bar, { height: 14, width: '60%' }]} />
        <View style={[s.bar, { height: 11, width: '40%', marginTop: 2 }]} />
        <View style={[s.bar, { height: 11, width: '35%' }]} />
        <View style={[s.bar, { height: 20, width: '45%', marginTop: 4 }]} />
      </Animated.View>
    </View>
  )
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <View style={s.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.gridItem}>
          <SkeletonCard />
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48%',
  },
  productRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  productImageWrap: {
    width: 128,
    padding: 12,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.g200,
  },
  productInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
    justifyContent: 'center',
  },
  bar: {
    borderRadius: radius.sm,
    backgroundColor: colors.g200,
  },
})
