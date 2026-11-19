import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { authFetch } from '@/lib/auth'
import { imgUrl, type CrownedStore, type UserProfile } from '@/lib/api'
import { VerifiedSeal } from '@/components/VerifiedBadge'
import { fonts } from '@/constants/theme'

/*
 * Gold "crowned" (paid promotion) store rail + the crowned seller strip.
 * Port of vatix_website/components/crowned-store-rail.tsx — gold = paid,
 * blue seal = verified; the two never mix.
 */

const GOLD = '#FFD84D'
const NAVY = '#1A2540'
const MUTED = '#AEB4C2'
const CARD_W = 292
const GAP = 12
const INTERVAL = CARD_W + GAP
const PAD = 16
const IDLE_MS = 5000
const TOUCH_IDLE_MS = 8000

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const arDigits = (s: string | number) => String(s).replace(/\d/g, d => AR_DIGITS[Number(d)])
const monogram = (name: string) => (name.match(/[A-Za-z0-9؀-ۿ]/)?.[0] ?? '?').toUpperCase()
const priceText = (price: number, ar: boolean) => {
  const n = Number(price).toLocaleString(ar ? 'ar-EG' : 'en-EG')
  return ar ? `${n} ج.م` : `EGP ${n}`
}

// Dismissed for the rest of the app session.
let ownerSlotDismissed = false

type Stops = [number, string][]
const FOIL: Stops = [[0, '#FFE27A'], [0.3, '#8A6200'], [0.55, '#F5B800'], [0.8, '#FFF3C4'], [1, '#B88400']]
const GOLD_BTN: Stops = [[0, '#FFE27A'], [0.55, '#F5B800'], [1, '#E0A400']]

function useGid(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`
}

export function useReduceMotion() {
  const [reduce, setReduce] = useState(true)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then(r => alive && setReduce(r))
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduce
}

/** True while the hosting screen is focused — loops stop when the user switches tabs. */
export function useScreenFocused() {
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )
  return focused
}

/** Absolute-fill gradient behind a View's children (no expo-linear-gradient in this app). */
export function GoldFill({
  stops = GOLD_BTN,
  vertical = false,
}: {
  stops?: Stops
  vertical?: boolean
}) {
  const gid = useGid('gf')
  // Measured in px: a "100%" Svg keeps its first size when the parent later grows
  // (images/fonts loading), which left the rail and card backgrounds cut short.
  const [size, setSize] = useState({ w: 0, h: 0 })
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        const { width: w, height: h } = e.nativeEvent.layout
        setSize(s => (s.w === w && s.h === h ? s : { w, h }))
      }}
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2={vertical ? '0' : '1'} y2="1">
              {stops.map(([o, c]) => (
                <Stop key={o} offset={o} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid})`} />
        </Svg>
      ) : null}
    </View>
  )
}

// Bright bands on a dark-gold base: rotating it walks the light around the border (RN has no conic gradient).
const SPIN: Stops = [
  [0, '#8A6200'],
  [0.22, '#FFF3C4'],
  [0.36, '#F5B800'],
  [0.5, '#8A6200'],
  [0.64, '#F5B800'],
  [0.78, '#FFF3C4'],
  [1, '#8A6200'],
]

/**
 * Gold foil that slowly turns (website `cr-spin`, 5s). Absolute-fill — the parent's
 * padding is the visible border width and it must clip (`overflow: 'hidden'`).
 */
export function SpinningFoil({ active, stops = FOIL }: { active: boolean; stops?: Stops }) {
  const reduce = useReduceMotion()
  const spin = useRef(new Animated.Value(0)).current
  const [size, setSize] = useState({ w: 0, h: 0 })
  const on = active && !reduce && size.w > 0 && size.h > 0
  useEffect(() => {
    if (!on) {
      spin.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [on, spin])
  const side = Math.ceil(Math.hypot(size.w, size.h))
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        const { width: w, height: h } = e.nativeEvent.layout
        setSize(s => (s.w === w && s.h === h ? s : { w, h }))
      }}
    >
      <GoldFill stops={stops} />
      {on ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: side,
            height: side,
            top: (size.h - side) / 2,
            left: (size.w - side) / 2,
            transform: [{ rotate }],
          }}
        >
          <GoldFill stops={SPIN} />
        </Animated.View>
      ) : null}
    </View>
  )
}

/** Crown that bobs and tilts on its base (website `cr-bob`, 3.2s). */
export function BobbingCrown({ size = 20, active = true }: { size?: number; active?: boolean }) {
  const reduce = useReduceMotion()
  const t = useRef(new Animated.Value(0)).current
  const on = active && !reduce
  useEffect(() => {
    if (!on) {
      t.setValue(0)
      return
    }
    const ease = Easing.inOut(Easing.ease)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1600, easing: ease, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1600, easing: ease, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [on, t])
  if (!on) return <CrownIcon size={size} />
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -3] })
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] })
  return (
    <Animated.View style={{ transformOrigin: 'bottom', transform: [{ translateY }, { rotate }] }}>
      <CrownIcon size={size} />
    </Animated.View>
  )
}

const CROWN_PATH = 'M3 8.5l4.2 3.6L12 5l4.8 7.1L21 8.5l-1.8 9.5H4.8z'

export function CrownIcon({
  size = 20,
  compact = false,
  color = NAVY,
}: {
  size?: number
  compact?: boolean
  color?: string
}) {
  const gid = useGid('crg')
  if (compact) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={CROWN_PATH} fill={color} />
        <Rect x={4.6} y={18.6} width={14.8} height={2.4} rx={1} fill={color} />
      </Svg>
    )
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF0B0" />
          <Stop offset="0.45" stopColor="#F5B800" />
          <Stop offset="1" stopColor="#B07E00" />
        </LinearGradient>
      </Defs>
      <Path d={CROWN_PATH} fill={`url(#${gid})`} stroke="#7A5600" strokeWidth={0.6} strokeLinejoin="round" />
      <Rect x={4.6} y={18.6} width={14.8} height={2.4} rx={1} fill={`url(#${gid})`} stroke="#7A5600" strokeWidth={0.6} />
      {[[3, 8.5], [12, 5], [21, 8.5]].map(([cx, cy]) => (
        <Circle key={cx} cx={cx} cy={cy} r={1.6} fill="#FFE27A" stroke="#7A5600" strokeWidth={0.5} />
      ))}
    </Svg>
  )
}

/** Gold "Crowned" pill — short on the seller card, `full` («متجر متوّج») on the store page. */
export function CrownedPill({ full = false }: { full?: boolean }) {
  const { locale } = useLocale()
  const label = full
    ? locale === 'ar' ? 'متجر متوّج' : 'Crowned store'
    : locale === 'ar' ? 'متوّج' : 'Crowned'
  return (
    <View style={[styles.pill, full && styles.pillFull]}>
      <GoldFill />
      <CrownIcon size={full ? 13 : 11} compact />
      <Text style={[styles.pillText, full && styles.pillTextFull]}>{label}</Text>
    </View>
  )
}

function AdTag({ style }: { style?: StyleProp<ViewStyle> }) {
  const { locale } = useLocale()
  return (
    <View style={[styles.adTag, style]}>
      <Text style={styles.adTagText}>{locale === 'ar' ? 'إعلان' : 'Ad'}</Text>
    </View>
  )
}

/** Cover → blurred logo → monogram, so a store without a cover still looks finished. */
function StoreCover({ store }: { store: CrownedStore }) {
  const cover = imgUrl(store.cover, { w: 600 })
  const logo = imgUrl(store.logo, { w: 120 })
  if (cover) {
    return (
      <Image
        source={{ uri: cover }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        recyclingKey={`cr-cover-${store.id}`}
      />
    )
  }
  if (logo) {
    return (
      <>
        <Image
          source={{ uri: logo }}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.4 }] }]}
          contentFit="cover"
          blurRadius={16}
          cachePolicy="memory-disk"
          recyclingKey={`cr-blur-${store.id}`}
        />
        <GoldFill vertical stops={[[0, 'rgba(14,21,38,0.55)'], [1, 'rgba(14,21,38,0.82)']]} />
      </>
    )
  }
  return <GoldFill stops={[[0, '#3A2C00'], [0.7, '#0E1526'], [1, '#0E1526']]} />
}

/** One soft shine across the card header. Physical LTR box so RTL doesn't flip `left` under an un-flipped translateX. */
function Glint({ width, active }: { width: number; active: boolean }) {
  const { isRtl } = useLocale()
  const reduce = useReduceMotion()
  const x = useRef(new Animated.Value(0)).current
  const on = active && !reduce && width > 0
  useEffect(() => {
    if (!on) {
      x.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(x, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(3800),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [on, x])
  if (!on) return null
  const band = width * 0.34
  // Sweep in reading direction: left→right in English, right→left in Arabic.
  const from = -band * 1.4
  const to = width + band * 0.4
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: isRtl ? [to, from] : [from, to] })
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glintClip]}>
      <Animated.View
        style={[styles.glint, { width: band, transform: [{ translateX }, { skewX: isRtl ? '12deg' : '-12deg' }] }]}
      >
        <GoldFill stops={[[0, 'rgba(255,240,190,0)'], [0.5, 'rgba(255,240,190,0.3)'], [1, 'rgba(255,240,190,0)']]} />
      </Animated.View>
    </View>
  )
}

function StoreCard({
  store,
  width,
  solo,
  animate,
}: {
  store: CrownedStore
  width: number
  solo: boolean
  animate: boolean
}) {
  const { locale, isRtl } = useLocale()
  const ar = locale === 'ar'
  const dir = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const logo = imgUrl(store.logo, { w: 120 })
  const sales = store.salesRecord?.total ?? 0
  const city = store.city ? (ar ? store.city.ar : store.city.en) ?? store.city.ar : null
  const sub = [sales > 0 ? (ar ? `${arDigits(sales)} عملية بيع` : `${sales} sales`) : null, city]
    .filter(Boolean)
    .join(' · ')
  const cols = solo ? 4 : 3
  const thumbs = store.products.slice(0, cols)
  const innerW = width - 3
  const tile = (innerW - 24 - 7 * (cols - 1)) / cols

  return (
    <View style={[styles.foil, { width }]}>
      <SpinningFoil active={animate} />
      <View style={[styles.cardInner, { direction: isRtl ? 'rtl' : 'ltr' }]}>
        <GoldFill vertical stops={[[0, '#1F2B47'], [1, '#141C31']]} />

        <Pressable onPress={() => router.push(`/store/${store.id}`)}>
          <View style={styles.cover}>
            <StoreCover store={store} />
            <GoldFill vertical stops={[[0, 'rgba(31,43,71,0)'], [0.45, 'rgba(31,43,71,0)'], [1, 'rgba(31,43,71,0.97)']]} />
            <AdTag style={styles.coverAd} />
            <View style={styles.ribbon}>
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 30 48" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={`rb-${store.id}`} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#FFE27A" />
                    <Stop offset="0.55" stopColor="#F5B800" />
                    <Stop offset="1" stopColor="#E0A400" />
                  </LinearGradient>
                </Defs>
                <Polygon points="0,0 30,0 30,48 15,39.4 0,48" fill={`url(#rb-${store.id})`} />
              </Svg>
              <CrownIcon size={13} compact />
              <Text style={styles.ribbonText}>{ar ? 'متوّج' : 'Crowned'}</Text>
            </View>
          </View>

          <View style={styles.idRow}>
            <View style={styles.logoWrap}>
              <View style={styles.ring}>
                <SpinningFoil
                  active={animate}
                  stops={[[0, '#FFE27A'], [0.35, '#E0A400'], [0.6, '#8A6200'], [0.85, '#FFD84D'], [1, '#FFE27A']]}
                />
                <View style={styles.logoInner}>
                  {logo ? (
                    <Image
                      source={{ uri: logo }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      recyclingKey={`cr-logo-${store.id}`}
                    />
                  ) : (
                    <Text style={styles.mono}>{monogram(store.name)}</Text>
                  )}
                </View>
              </View>
              <View style={styles.logoCrown} pointerEvents="none">
                <BobbingCrown size={23} active={animate} />
              </View>
            </View>
            <View style={styles.who}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, dir]} numberOfLines={1}>
                  {store.name}
                </Text>
                {store.verification?.verified ? <VerifiedSeal size={14} /> : null}
              </View>
              {sub ? (
                <Text style={[styles.sub, dir]} numberOfLines={1}>
                  {sub}
                </Text>
              ) : null}
            </View>
            <View style={styles.visit}>
              <GoldFill />
              <Text style={styles.visitText} numberOfLines={1}>
                {ar ? 'زيارة المتجر' : 'Visit store'}
              </Text>
            </View>
          </View>

          <Glint width={innerW} active={animate} />
        </Pressable>

        {thumbs.length > 0 && (
          <View style={styles.thumbs}>
            {thumbs.map(p => {
              const src = imgUrl(p.image, { w: 240 })
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/products/${p.id}`)}
                  style={({ pressed }) => [styles.thumb, { width: tile, height: tile }, pressed && { opacity: 0.85 }]}
                  accessibilityLabel={p.title}
                >
                  {src ? (
                    <Image
                      source={{ uri: src }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      recyclingKey={`cr-p-${p.id}`}
                    />
                  ) : null}
                  <View style={styles.priceChip}>
                    <Text style={styles.priceText} numberOfLines={1}>
                      {priceText(p.price, ar)}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
}

function useOwnerSlot(stores: CrownedStore[], enabled: boolean) {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const inList = !!user && stores.some(s => s.id === user.id)
  const eligible = enabled && !!user?.isStore && !inList && !ownerSlotDismissed

  useEffect(() => {
    if (!eligible) {
      setShow(false)
      return
    }
    let alive = true
    authFetch<UserProfile>('/user/profile')
      .then(p => {
        if (!alive || !p) return
        const until = p.storeProfile?.promotedUntil
        setShow(!until || new Date(until).getTime() <= Date.now())
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [eligible])

  const dismiss = () => {
    ownerSlotDismissed = true
    setShow(false)
  }
  return { show: show && eligible, dismiss }
}

function OwnerSlot({ onDismiss }: { onDismiss: () => void }) {
  const { locale, isRtl } = useLocale()
  const ar = locale === 'ar'
  const dir = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  return (
    <View style={styles.slotWrap}>
      <Pressable
        onPress={() => router.push('/dashboard/promote-store')}
        style={({ pressed }) => [styles.slot, pressed && { opacity: 0.9 }]}
      >
        <GoldFill stops={[[0, '#FFF9E6'], [1, '#FFF3C4']]} />
        <CrownIcon size={34} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.slotTitle, dir]}>
            {ar ? 'المكان ده فاضي — توّج متجرك وأظهر هنا' : 'This spot is empty — crown your store and appear here'}
          </Text>
          <Text style={[styles.slotSub, dir]}>
            {ar ? '٥٠٠ ج.م لمدة ٥ أيام · أول شريط في صفحة المنتجات' : 'EGP 500 for 5 days · first rail on the products page'}
          </Text>
        </View>
        <View style={styles.slotCta}>
          <Text style={styles.slotCtaText}>{ar ? 'توّج متجرك' : 'Crown your store'}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        style={styles.slotX}
        accessibilityRole="button"
        accessibilityLabel={ar ? 'إخفاء' : 'Dismiss'}
      >
        <Text style={styles.slotXText}>×</Text>
      </Pressable>
    </View>
  )
}

export function CrownedStoreRail({
  stores,
  subtitle,
  showOwnerSlot = true,
}: {
  stores: CrownedStore[]
  subtitle?: string
  showOwnerSlot?: boolean
}) {
  const { locale, isRtl } = useLocale()
  const ar = locale === 'ar'
  const dir = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const { width: screenW } = useWindowDimensions()
  const slot = useOwnerSlot(stores, showOwnerSlot)
  const reduce = useReduceMotion()
  const focused = useScreenFocused()
  const n = stores.length
  const solo = n === 1

  const scrollRef = useRef<ScrollView>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const touchingRef = useRef(false)
  const lastMoveRef = useRef(Date.now())

  const hold = () => {
    touchingRef.current = true
    lastMoveRef.current = Date.now() + TOUCH_IDLE_MS - IDLE_MS
  }
  const release = () => {
    touchingRef.current = false
    lastMoveRef.current = Date.now() + TOUCH_IDLE_MS - IDLE_MS
  }

  useEffect(() => {
    if (n < 2 || reduce || !focused) return
    const id = setInterval(() => {
      if (touchingRef.current || Date.now() - lastMoveRef.current < IDLE_MS) return
      const next = (activeRef.current + 1) % n
      scrollRef.current?.scrollTo({ x: next * INTERVAL, animated: true })
      lastMoveRef.current = Date.now()
    }, 1000)
    return () => clearInterval(id)
  }, [n, reduce, focused])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / INTERVAL)))
    if (i !== activeRef.current) {
      activeRef.current = i
      setActive(i)
    }
  }

  const ownerSlot = slot.show ? <OwnerSlot onDismiss={slot.dismiss} /> : null
  if (n === 0) return ownerSlot

  return (
    <>
      <View style={styles.rail}>
        <GoldFill vertical stops={[[0, '#16203A'], [1, '#0F1729']]} />
        <Svg pointerEvents="none" width={260} height={200} style={[styles.glow, isRtl ? { left: -70 } : { right: -70 }]}>
          <Defs>
            <RadialGradient id="crown-rail-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F5B800" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#F5B800" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={260} height={200} fill="url(#crown-rail-glow)" />
        </Svg>
        <View pointerEvents="none" style={[styles.hairline, { top: 0 }]} />
        <View pointerEvents="none" style={[styles.hairline, { bottom: 0 }]} />

        <View style={styles.head}>
          <CrownIcon size={20} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.title, dir]} numberOfLines={1}>
              {ar ? 'متاجر متوّجة' : 'Crowned stores'}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, dir]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <AdTag />
          <View style={{ flex: 1 }} />
          {n > 1 && (
            <Pressable onPress={() => router.push('/(tabs)/stores')} hitSlop={8}>
              <Text style={styles.link}>{ar ? 'عرض الكل ←' : 'View all →'}</Text>
            </Pressable>
          )}
        </View>

        {solo ? (
          <View style={{ paddingHorizontal: PAD }}>
            <StoreCard store={stores[0]} width={screenW - PAD * 2} solo animate={focused} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            style={{ direction: 'ltr' }}
            showsHorizontalScrollIndicator={false}
            snapToInterval={INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={styles.track}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onTouchStart={hold}
            onTouchEnd={release}
            onTouchCancel={release}
            onScrollBeginDrag={hold}
            onScrollEndDrag={release}
          >
            {stores.map((s, i) => (
              <StoreCard key={s.id} store={s} width={CARD_W} solo={false} animate={focused && i === active} />
            ))}
          </ScrollView>
        )}

        {n > 1 && (
          <View style={styles.dots}>
            {stores.map((s, i) => (
              <Pressable
                key={s.id}
                hitSlop={6}
                onPress={() => {
                  release()
                  scrollRef.current?.scrollTo({ x: i * INTERVAL, animated: true })
                }}
                style={[styles.dot, i === active && styles.dotOn]}
              />
            ))}
          </View>
        )}
      </View>
      {ownerSlot}
    </>
  )
}

/** "More from <store>" — shown on a crowned seller's product page instead of the rail. */
export function CrownedStrip({
  title,
  storeId,
  linkLabel,
  products,
}: {
  title: string
  storeId: number
  linkLabel: string
  products: { id: number; title: string; price: number | string; images?: { url: string }[] }[]
}) {
  const { locale, isRtl } = useLocale()
  const ar = locale === 'ar'
  const dir = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  if (products.length === 0) return null
  return (
    <View style={styles.strip}>
      <GoldFill vertical stops={[[0, '#1B2640'], [1, '#121A2E']]} />
      <View style={styles.stripHead}>
        <CrownIcon size={18} />
        <Text style={[styles.stripTitle, dir]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable onPress={() => router.push(`/store/${storeId}`)} hitSlop={8}>
          <Text style={styles.stripLink}>{linkLabel}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        style={{ direction: 'ltr' }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripRow}
      >
        {products.map(p => {
          const src = imgUrl(p.images?.[0]?.url, { w: 280 })
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/products/${p.id}`)}
              style={({ pressed }) => [styles.stripCard, { direction: isRtl ? 'rtl' : 'ltr' }, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.stripImg}>
                {src ? (
                  <Image
                    source={{ uri: src }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={120}
                    recyclingKey={`cs-p-${p.id}`}
                  />
                ) : null}
              </View>
              <View style={styles.stripBody}>
                <Text style={[styles.stripName, dir]} numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={[styles.stripPrice, dir]} numberOfLines={1}>
                  {priceText(Number(p.price), ar)}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  // rail
  rail: { paddingTop: 14, paddingBottom: 12, overflow: 'hidden', backgroundColor: '#121A2E' },
  glow: { position: 'absolute', top: -100 },
  hairline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,216,77,0.7)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: PAD, marginBottom: 10 },
  title: { fontFamily: fonts.black, fontSize: 15.5, color: GOLD, includeFontPadding: false },
  subtitle: { fontFamily: fonts.semiBold, fontSize: 11, color: MUTED, includeFontPadding: false },
  link: { fontFamily: fonts.extraBold, fontSize: 12, color: GOLD },
  adTag: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 5,
    paddingHorizontal: 5,
  },
  adTagText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 15, color: MUTED, includeFontPadding: false },
  track: { gap: GAP, paddingHorizontal: PAD },
  dots: { flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 18, borderRadius: 4, backgroundColor: '#F5B800' },

  // card
  foil: { borderRadius: 20, padding: 1.5, overflow: 'hidden', backgroundColor: '#C99A1A' },
  cardInner: { borderRadius: 19, overflow: 'hidden', backgroundColor: '#18223B' },
  cover: { height: 72, backgroundColor: '#0E1526', overflow: 'hidden' },
  coverAd: { position: 'absolute', top: 8, start: 10, backgroundColor: 'rgba(14,21,38,0.55)' },
  ribbon: {
    position: 'absolute',
    top: 0,
    end: 12,
    width: 30,
    height: 48,
    paddingTop: 6,
    alignItems: 'center',
    gap: 2,
  },
  ribbonText: { fontFamily: fonts.black, fontSize: 9.5, lineHeight: 14, color: NAVY, includeFontPadding: false },
  idRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 12,
    marginTop: -24,
  },
  logoWrap: { width: 52, height: 52 },
  ring: { width: 52, height: 52, borderRadius: 26, padding: 2.5, overflow: 'hidden' },
  logoInner: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mono: { fontFamily: fonts.black, fontSize: 20, color: NAVY, includeFontPadding: false },
  logoCrown: { position: 'absolute', top: -19, left: 0, right: 0, alignItems: 'center' },
  who: { flex: 1, minWidth: 0, paddingBottom: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flexShrink: 1, fontFamily: fonts.black, fontSize: 14, color: GOLD, includeFontPadding: false },
  sub: { fontFamily: fonts.regular, fontSize: 11, color: MUTED, includeFontPadding: false },
  visit: { flexShrink: 0, borderRadius: 9, paddingHorizontal: 11, overflow: 'hidden', marginBottom: 2 },
  visitText: { fontFamily: fonts.extraBold, fontSize: 11.5, lineHeight: 30, color: NAVY, includeFontPadding: false },
  thumbs: { flexDirection: 'row', gap: 7, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12 },
  thumb: { borderRadius: 11, backgroundColor: '#fff', overflow: 'hidden' },
  priceChip: {
    position: 'absolute',
    bottom: 5,
    start: 5,
    maxWidth: '90%',
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(15,23,41,0.86)',
  },
  priceText: { fontFamily: fonts.extraBold, fontSize: 10.5, lineHeight: 18, color: GOLD, includeFontPadding: false },
  glintClip: { overflow: 'hidden', direction: 'ltr' },
  glint: { position: 'absolute', top: '-50%', bottom: '-50%', left: 0 },

  // crowned pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  pillText: { fontFamily: fonts.black, fontSize: 11, lineHeight: 20, color: NAVY, includeFontPadding: false },
  pillFull: { gap: 4, paddingHorizontal: 10 },
  pillTextFull: { fontSize: 12, lineHeight: 24 },

  // owner slot
  slotWrap: { marginTop: 12, marginBottom: 4, marginHorizontal: PAD },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E0A400',
    paddingVertical: 14,
    paddingStart: 16,
    paddingEnd: 34,
    overflow: 'hidden',
  },
  slotTitle: { fontFamily: fonts.black, fontSize: 14, color: NAVY, includeFontPadding: false },
  slotSub: { fontFamily: fonts.regular, fontSize: 12, color: '#7A5600', marginTop: 2, includeFontPadding: false },
  slotCta: { borderRadius: 10, paddingHorizontal: 12, backgroundColor: NAVY },
  slotCtaText: { fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 32, color: GOLD, includeFontPadding: false },
  slotX: {
    position: 'absolute',
    top: 6,
    end: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(122,86,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotXText: { fontSize: 15, lineHeight: 17, color: '#7A5600', includeFontPadding: false },

  // strip
  strip: { paddingTop: 14, paddingBottom: 16, overflow: 'hidden' },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: PAD, paddingBottom: 10 },
  stripTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 15, color: GOLD, includeFontPadding: false },
  stripLink: { fontFamily: fonts.bold, fontSize: 12, color: MUTED },
  stripRow: { gap: 10, paddingHorizontal: PAD },
  stripCard: {
    width: 132,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    overflow: 'hidden',
  },
  stripImg: { width: '100%', aspectRatio: 1, backgroundColor: '#EEF0F4' },
  stripBody: { paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10 },
  stripName: { fontFamily: fonts.tajawalBold, fontSize: 12.5, lineHeight: 18, height: 36, color: NAVY },
  stripPrice: { fontFamily: fonts.black, fontSize: 15, color: '#062B5B', marginTop: 3, includeFontPadding: false },
})
