import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { colors, fonts } from '@/constants/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

export type TabIcons = Record<string, { active: IoniconsName; inactive: IoniconsName }>

// Bar geometry. The active tab's icon rides in a yellow bubble that sits in a notch cut into the bar's top edge.
const BAR_H = 60
const BUBBLE = 50
const NOTCH_DEPTH = 34
const NOTCH_HALF = 46
const BUBBLE_TOP = NOTCH_DEPTH - 5 - BUBBLE // bubble floats 5px above the notch floor
const CORNER = 24
const LABEL_GAP = 16 // breathing room under the labels, above the safe-area inset

// White strip 2× the screen width with the notch at its middle; sliding it sideways moves the notch
// without re-drawing the path, so the native driver can animate it.
function notchPath(w: number, h: number) {
  const cx = w
  return [
    `M0 0`,
    `H${cx - NOTCH_HALF}`,
    `C${cx - 30} 0 ${cx - 32} ${NOTCH_DEPTH} ${cx} ${NOTCH_DEPTH}`,
    `C${cx + 32} ${NOTCH_DEPTH} ${cx + 30} 0 ${cx + NOTCH_HALF} 0`,
    `H${w * 2} V${h} H0 Z`,
  ].join(' ')
}

export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  visible,
  icons,
  isRtl,
  bottomInset,
  onFabPress,
  fabLabel,
}: BottomTabBarProps & {
  visible: string[]
  icons: TabIcons
  isRtl: boolean
  bottomInset: number
  onFabPress: () => void
  fabLabel: string
}) {
  const { width } = useWindowDimensions()
  const height = BAR_H + LABEL_GAP + Math.max(bottomInset, 8)
  const routes = visible
    .map(name => state.routes.find(r => r.name === name))
    .filter((r): r is (typeof state.routes)[number] => !!r)
  const focusedName = state.routes[state.index]?.name

  // Tab centers measured from layout (physical x), so RTL ordering needs no special maths.
  const [centers, setCenters] = useState<Record<string, number>>({})
  const x = useRef(new Animated.Value(width / 2)).current
  const pop = useRef(new Animated.Value(1)).current
  const placed = useRef(false)
  const stripX = useMemo(() => Animated.subtract(x, width), [x, width])
  const bubbleX = useMemo(() => Animated.subtract(x, BUBBLE / 2), [x])

  const target = focusedName ? centers[focusedName] : undefined
  useEffect(() => {
    if (target == null) return
    if (!placed.current) {
      x.setValue(target)
      placed.current = true
      return
    }
    pop.setValue(0.6)
    Animated.parallel([
      Animated.spring(x, { toValue: target, useNativeDriver: true, damping: 16, stiffness: 170, mass: 0.9 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 180 }),
    ]).start()
  }, [target, x, pop])

  // When the focused screen isn't on the bar (e.g. a hidden tab) the bubble/notch tuck away.
  const hasBubble = target != null

  const activeIcons = focusedName ? icons[focusedName] : undefined

  return (
    <View style={[styles.wrap, { height }]}>
      <View style={[styles.bar, { height }]}>
        <Animated.View
          style={[
            styles.strip,
            { width: width * 2, height, transform: [{ translateX: stripX }] },
          ]}
          pointerEvents="none"
        >
          <Svg width={width * 2} height={height}>
            <Path d={hasBubble ? notchPath(width, height) : `M0 0 H${width * 2} V${height} H0 Z`} fill={colors.white} stroke={colors.g200} strokeWidth={1} />
          </Svg>
        </Animated.View>

        <View style={[styles.row, { direction: isRtl ? 'rtl' : 'ltr', paddingBottom: height - BAR_H }]}>
          {routes.map(route => {
            const options = descriptors[route.key]?.options ?? {}
            const label = typeof options.title === 'string' ? options.title : route.name
            const focused = route.name === focusedName
            const onLayout = (e: { nativeEvent: { layout: { x: number; width: number } } }) => {
              const c = e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2
              setCenters(prev => (prev[route.name] === c ? prev : { ...prev, [route.name]: c }))
            }

            if (route.name === 'add') {
              return (
                <View key={route.key} style={[styles.item, { justifyContent: 'center', paddingTop: 0 }]} onLayout={onLayout}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={fabLabel}
                    onPress={onFabPress}
                    style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
                  >
                    <Ionicons name="add" size={28} color={colors.y} />
                  </Pressable>
                </View>
              )
            }

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params)
            }
            const set = icons[route.name]
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={onPress}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={styles.item}
                onLayout={onLayout}
              >
                <View style={[styles.iconBox, focused && { opacity: 0 }]}>
                  {set && <Ionicons name={set.inactive} size={23} color={colors.g500} />}
                </View>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, focused && styles.labelActive]}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {hasBubble && activeIcons && (
        <Animated.View
          pointerEvents="none"
          style={[styles.bubble, { transform: [{ translateX: bubbleX }, { scale: pop }] }]}
        >
          <Ionicons name={activeIcons.active} size={24} color={colors.dk} />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Page-grey behind the rounded corners and the notch so they read against the screen above.
  wrap: { backgroundColor: colors.g100, direction: 'ltr' },
  bar: {
    borderTopLeftRadius: CORNER,
    borderTopRightRadius: CORNER,
    overflow: 'hidden',
  },
  strip: { position: 'absolute', top: 0, left: 0 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  // Top-aligned with a fixed label line box: Cairo's tall line height used to overflow a centred item and eat the gap below.
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8, gap: 3 },
  iconBox: { height: 26, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 16, color: colors.g500 },
  labelActive: { fontFamily: fonts.bold, color: colors.dk, marginTop: 4 },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    top: BUBBLE_TOP,
    left: 0,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.y,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
})
