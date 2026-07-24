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
})
