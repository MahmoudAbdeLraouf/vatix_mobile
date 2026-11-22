import { useEffect, useRef } from 'react'
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native'
import { darkColors, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

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
  const { colors } = useTheme()
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
          backgroundColor: colors.border,
          opacity,
        },
        style as ViewStyle,
      ]}
    />
  )
}

export function SkeletonCard() {
  const s = useStyles()
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
  const s = useStyles()
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

// Placeholder that mirrors ProductCard's `row` variant (112px thumb,
// price/title/meta stack) so blank list areas read as rows still
// loading. One pulse per row instead of one per bar keeps it cheap to stack.
export function SkeletonProductRow() {
  const s = useStyles()
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
      <View style={s.productTop}>
        <Animated.View style={[s.productImage, { opacity }]} />
        <Animated.View style={[s.productInfo, { opacity }]}>
          <View style={[s.bar, { height: 15, width: '90%' }]} />
          <View style={[s.bar, { height: 15, width: '60%' }]} />
          <View style={[s.bar, { height: 22, width: '45%', marginTop: 6 }]} />
          <View style={[s.bar, { height: 11, width: '70%', marginTop: 'auto' }]} />
        </Animated.View>
      </View>
      <View style={s.productDivider} />
      <Animated.View style={[s.productFooter, { opacity }]}>
        <View style={s.avatar} />
        <View style={[s.bar, { height: 13, width: 90 }]} />
        <View style={s.footerSpacer} />
        <View style={s.roundBtn} />
        <View style={s.roundBtn} />
        <View style={s.roundBtn} />
      </Animated.View>
    </View>
  )
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  const s = useStyles()
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48%',
  },
  // Mirrors ProductRowCard: 120px thumb row, hairline divider, seller + round contact footer.
  productRow: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  productTop: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
  },
  productDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    backgroundColor: colors.border,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingTop: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
  },
  footerSpacer: {
    flex: 1,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  productInfo: {
    flex: 1,
    gap: 6,
  },
  bar: {
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
function useStyles() { return themedStyles[useTheme().mode] }
