import React, { useEffect, useId, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts } from '@/constants/theme'

// Dark "spotlight" palette for the store-promotion screen.
export const P = {
  y: '#F5B800',
  y2: '#FFD84D',
  dk: '#1A2540',
  ink: '#0E1526',
  ink2: '#141d33',
  g400: '#a7adba',
  g500: '#8a91a0',
  g700: '#4a5162',
  glass: 'rgba(255,255,255,0.06)',
  line: 'rgba(255,255,255,0.09)',
  live: '#22c55e',
  liveText: '#86efac',
  boostText: '#f3e3a6',
  winLabel: '#5a4500',
}

// ── helpers ──────────────────────────────────────────────────────────────

function txt(ar: boolean, align: 'start' | 'center' = 'start'): TextStyle {
  return {
    writingDirection: ar ? 'rtl' : 'ltr',
    textAlign: align === 'center' ? 'center' : ar ? 'right' : 'left',
  }
}

function row(ar: boolean): ViewStyle {
  return { flexDirection: ar ? 'row-reverse' : 'row' }
}

// Mirrors a physical side: "start" is right in Arabic, left in English.
function side(ar: boolean, which: 'start' | 'end', value: number): { left?: number; right?: number } {
  const right = (which === 'start') === ar
  return right ? { right: value } : { left: value }
}

function useGradId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '')
}

function useLoop(duration: number, opts: { delay?: number; pingPong?: boolean; rest?: number } = {}) {
  const v = useRef(new Animated.Value(0)).current
  const { delay = 0, pingPong = false, rest = 0 } = opts
  useEffect(() => {
    const ease = Easing.inOut(Easing.ease)
    const body = pingPong
      ? Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: duration / 2, easing: ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: duration / 2, easing: ease, useNativeDriver: true }),
        ])
      : Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
          Animated.delay(rest),
        ])
    const anim = Animated.sequence([Animated.delay(delay), Animated.loop(body)])
    anim.start()
    return () => anim.stop()
  }, [v, duration, delay, pingPong, rest])
  return v
}

type GradStop = { offset: string; color: string; opacity?: number }

function Grad({
  stops,
  radial,
  rx = 0,
  x2 = '0',
  y2 = '1',
  cx = '50%',
  cy = '0%',
  r = '70%',
}: {
  stops: GradStop[]
  radial?: boolean
  rx?: number
  x2?: string
  y2?: string
  cx?: string
  cy?: string
  r?: string
}) {
  const id = useGradId('g')
  // Measure instead of width/height="100%": on iOS a percentage-sized Svg
  // doesn't track a content-sized parent, so the fill came out short.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const stopEls = stops.map((s) => (
    <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
  ))
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }))
      }}
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            {radial ? (
              <RadialGradient id={id} cx={cx} cy={cy} rx={r} ry={r} fx={cx} fy={cy}>
                {stopEls}
              </RadialGradient>
            ) : (
              <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
                {stopEls}
              </LinearGradient>
            )}
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} rx={rx} ry={rx} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  )
}

// Renders "**bold**" segments in the accent colour.
function RichText({ text, style, boldColor = P.y2 }: { text: string; style: StyleProp<TextStyle>; boldColor?: string }) {
  const parts = text.split('**')
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: fonts.black, color: boldColor }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  )
}

function Beam() {
  const swing = useLoop(6000, { pingPong: true })
  const id = useGradId('beam')
  const rotate = swing.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] })
  return (
    <View style={s.beamWrap} pointerEvents="none">
      <Animated.View style={{ width: 520, height: 470, transformOrigin: 'top', transform: [{ rotate }] }}>
        <Svg width={520} height={470} viewBox="0 0 520 470">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={P.y2} stopOpacity={0.28} />
              <Stop offset="1" stopColor={P.y2} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d="M230 0 L290 0 L470 470 L50 470 Z" fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
    </View>
  )
}

function Spark({ style, delay = 0 }: { style: ViewStyle; delay?: number }) {
  const v = useLoop(2400, { pingPong: true, delay })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.spark,
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }],
        },
      ]}
    />
  )
}

function StageBackground() {
  return (
    <Grad
      radial
      cx="50%"
      cy="0%"
      r="80%"
      stops={[
        { offset: '0', color: '#24355f' },
        { offset: '0.7', color: P.ink },
        { offset: '1', color: P.ink },
      ]}
    />
  )
}

// ── Stage: not promoted yet ──────────────────────────────────────────────

export function SpotlightStage(props: {
  ar: boolean
  name: string
  logoUrl: string | null
  subLine: string
  firstBadge: string
  featuredBadge: string
  title: string
  titleEm: string
  sub: string
}) {
  const { ar, name, logoUrl, subLine } = props
  const float = useLoop(4000, { pingPong: true })
  const [logoFailed, setLogoFailed] = useState(false)
  const initial = (name.trim()[0] || 'V').toUpperCase()

  return (
    <View style={[s.stage, { height: 380 }]}>
      <StageBackground />
      <Beam />
      <View style={s.floorGlow} pointerEvents="none">
        <Grad
          radial
          cx="50%"
          cy="50%"
          r="50%"
          stops={[
            { offset: '0', color: P.y2, opacity: 0.35 },
            { offset: '1', color: P.y2, opacity: 0 },
          ]}
        />
      </View>
      <Spark style={{ top: 70, ...side(ar, 'end', 70) }} />
      <Spark style={{ top: 160, ...side(ar, 'start', 52) }} delay={800} />
      <Spark style={{ top: 46, ...side(ar, 'start', 110) }} delay={1400} />
      <Spark style={{ top: 210, ...side(ar, 'end', 40) }} delay={400} />

      <View style={[s.centerAbs, { top: 188 }]} pointerEvents="none">
        <GhostRow ar={ar} width={270} opacity={0.7} />
      </View>
      <View style={[s.centerAbs, { top: 254 }]} pointerEvents="none">
        <GhostRow ar={ar} width={250} opacity={0.35} />
      </View>

      <View style={[s.centerAbs, { top: 100 }]}>
        <Animated.View
          style={[
            s.heroCard,
            { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
          ]}
        >
          <Grad
            rx={20}
            stops={[
              { offset: '0', color: '#FFFFFF' },
              { offset: '1', color: '#FFF9E6' },
            ]}
          />
          <Text style={[s.crown, side(ar, 'start', 18)]}>👑</Text>
          <View style={[s.rankPill, side(ar, 'end', 16)]}>
            <Text style={s.rankPillText}>{props.firstBadge}</Text>
          </View>
          <View style={[s.heroRow, row(ar)]}>
            <View style={s.heroLogo}>
              {logoUrl && !logoFailed ? (
                <Image source={{ uri: logoUrl }} style={s.heroLogoImg} onError={() => setLogoFailed(true)} />
              ) : (
                <Text style={s.heroInitial}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroName, txt(ar)]} numberOfLines={1}>
                {name}
              </Text>
              {subLine ? (
                <Text style={[s.heroSub, txt(ar)]} numberOfLines={1}>
                  {subLine}
                </Text>
              ) : null}
            </View>
            <View style={s.featPill}>
              <Text style={s.featPillText}>{props.featuredBadge}</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={s.stageCopy}>
        <Text style={[s.stageH2, txt(ar, 'center')]}>
          {props.title} <Text style={{ color: P.y2 }}>{props.titleEm}</Text>
        </Text>
        <Text style={[s.stageP, txt(ar, 'center')]}>{props.sub}</Text>
      </View>
    </View>
  )
}

function GhostRow({ ar, width, opacity }: { ar: boolean; width: number; opacity: number }) {
  return (
    <View style={[s.ghostRow, row(ar), { width, opacity }]}>
      <View style={s.ghostSquare} />
      <View style={s.ghostBar} />
    </View>
  )
}

// ── Stage: currently promoted ────────────────────────────────────────────

const RING_C = 2 * Math.PI * 94

export function PromotedStage(props: {
  ar: boolean
  daysLeft: number
  days: number
  liveLabel: string
  daysLeftLabel: string
  title: string
  titleEm: string
  sub: string
}) {
  const { ar, daysLeft, days } = props
  const id = useGradId('ring')
  const pulse = useLoop(1600)
  const frac = Math.max(0, Math.min(1, days > 0 ? daysLeft / days : 0))
  return (
    <View style={[s.stage, { height: 350 }]}>
      <StageBackground />
      <Beam />
      <Spark style={{ top: 70, ...side(ar, 'end', 60) }} />
      <Spark style={{ top: 200, ...side(ar, 'start', 44) }} delay={800} />
      <Spark style={{ top: 40, ...side(ar, 'start', 96) }} delay={1400} />

      <View style={[s.centerAbs, { top: 8 }]}>
        <View style={[s.livePill, row(ar)]}>
          <View style={s.liveDotWrap}>
            <Animated.View
              style={[
                s.liveHalo,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                },
              ]}
            />
            <View style={s.liveDot} />
          </View>
          <Text style={s.liveText}>{props.liveLabel}</Text>
        </View>
      </View>

      <View style={[s.centerAbs, { top: 46 }]}>
        <View style={{ width: 220, height: 220 }}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={P.y2} />
                <Stop offset="1" stopColor={P.y} />
              </LinearGradient>
            </Defs>
            <Circle cx={110} cy={110} r={94} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
            <G rotation={-90} origin="110,110">
              <Circle
                cx={110}
                cy={110}
                r={94}
                fill="none"
                stroke={`url(#${id})`}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={RING_C * (1 - frac)}
              />
            </G>
          </Svg>
          <View style={s.ringCenter}>
            <Text style={s.ringBig}>{daysLeft}</Text>
            <Text style={s.ringSmall}>{props.daysLeftLabel}</Text>
          </View>
        </View>
      </View>

      <View style={s.stageCopy}>
        <Text style={[s.stageH2, { fontSize: 24, lineHeight: 34 }, txt(ar, 'center')]}>
          {props.title} <Text style={{ color: P.y2 }}>{props.titleEm}</Text>
        </Text>
        <Text style={[s.stageP, txt(ar, 'center')]}>{props.sub}</Text>
      </View>
    </View>
  )
}

// ── Sections ─────────────────────────────────────────────────────────────

export function PromoSection(props: {
  ar: boolean
  title: string
  side?: string
  children: React.ReactNode
}) {
  const { ar } = props
  return (
    <View style={s.section}>
      <Grad
        rx={23}
        stops={[
          { offset: '0', color: P.ink2 },
          { offset: '1', color: '#111a2e' },
        ]}
      />
      <View style={[s.sectionHead, row(ar)]}>
        <Text style={[s.sectionTitle, txt(ar)]}>{props.title}</Text>
        {props.side ? <Text style={[s.sectionSide, txt(ar)]}>{props.side}</Text> : null}
      </View>
      {props.children}
    </View>
  )
}

export function BoostNote({ ar, icon, text }: { ar: boolean; icon: string; text: string }) {
  return (
    <View style={[s.boost, row(ar)]}>
      <View style={s.boostIcon}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </View>
      <RichText text={text} style={[s.boostText, txt(ar)]} />
    </View>
  )
}

export function ProfitEquation(props: {
  ar: boolean
  views: string
  contacts: string
  viewsLabel: string
  contactsLabel: string
  salesLabel: string
  profitLabel: string
  boost: string
}) {
  const { ar } = props
  const op = ar ? '←' : '→'
  return (
    <View>
      <View style={[s.eqRow, row(ar)]}>
        <EqNode emoji="👁" value={props.views} label={props.viewsLabel} />
        <Text style={s.eqOp}>{op}</Text>
        <EqNode emoji="💬" value={props.contacts} label={props.contactsLabel} />
        <Text style={s.eqOp}>{op}</Text>
        <EqNode emoji="💰" value={props.salesLabel} label={props.profitLabel} win />
      </View>
      <BoostNote ar={ar} icon="⚡" text={props.boost} />
    </View>
  )
}

function EqNode({ emoji, value, label, win }: { emoji: string; value: string; label: string; win?: boolean }) {
  return (
    <View style={[s.eqNode, win && s.eqNodeWin]}>
      {win ? (
        <Grad
          rx={17}
          x2="1"
          y2="1"
          stops={[
            { offset: '0', color: P.y },
            { offset: '1', color: '#ffcc1f' },
          ]}
        />
      ) : null}
      <Text style={s.eqEmoji}>{emoji}</Text>
      <Text style={[s.eqNum, win && { color: P.dk }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[s.eqLabel, win && { color: P.winLabel }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

export function ViewsSparkline(props: {
  ar: boolean
  data: number[]
  todayLabel: string
  axisFrom: string
  axisToday: string
}) {
  const { ar, data } = props
  const [w, setW] = useState(0)
  const id = useGradId('area')
  const H = 110
  const pad = 8
  const n = data.length
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data.map((v, i) => {
    const t = n > 1 ? i / (n - 1) : 1
    const x = ar ? w - pad - t * (w - 2 * pad) : pad + t * (w - 2 * pad)
    const y = H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad - 14)
    return { x, y }
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const areaPath = last && first ? `${linePath} L${last.x.toFixed(1)} ${H} L${first.x.toFixed(1)} ${H} Z` : ''

  return (
    <View>
      <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && last ? (
          <>
            <Svg width={w} height={H}>
              <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={P.y} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={P.y} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Line x1={0} x2={w} y1={H * 0.33} y2={H * 0.33} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <Line x1={0} x2={w} y1={H * 0.66} y2={H * 0.66} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <Path d={areaPath} fill={`url(#${id})`} />
              <Path d={linePath} fill="none" stroke={P.y} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <Circle cx={last.x} cy={last.y} r={5} fill={P.y2} stroke={P.ink2} strokeWidth={2} />
            </Svg>
            <View
              pointerEvents="none"
              style={[s.bubble, { top: Math.max(0, last.y - 32) }, ar ? { left: 0 } : { right: 0 }]}
            >
              <Text style={[s.bubbleText, txt(ar, 'center')]}>{props.todayLabel}</Text>
            </View>
          </>
        ) : null}
      </View>
      <View style={[s.axisRow, row(ar)]}>
        <Text style={s.axisText}>{props.axisFrom}</Text>
        <Text style={s.axisText}>{props.axisToday}</Text>
      </View>
    </View>
  )
}

export function PlacementsCarousel(props: {
  ar: boolean
  items: Array<{ title: string; sub: string }>
}) {
  const { ar, items } = props
  const variants: Array<'list' | 'product' | 'home'> = ['list', 'product', 'home']
  const scrollRef = useRef<ScrollView>(null)
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[s.carousel, { direction: 'ltr' }]}
      contentContainerStyle={[s.carouselContent, row(ar)]}
      onContentSizeChange={() => {
        // Arabic reads right-to-left: start the strip at its right edge.
        if (ar) scrollRef.current?.scrollToEnd({ animated: false })
      }}
    >
      {items.map((it, i) => (
        <View key={i} style={s.placeCard}>
          <MiniMock variant={variants[i] ?? 'list'} ar={ar} />
          <Text style={[s.placeTitle, txt(ar)]} numberOfLines={2}>
            {it.title}
          </Text>
          <Text style={[s.placeSub, txt(ar)]} numberOfLines={1}>
            {it.sub}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

function HlRow({ ar, height = 20 }: { ar: boolean; height?: number }) {
  return (
    <View style={[s.miniRow, s.miniRowHl, row(ar), { height }]}>
      <View style={s.miniHlSquare} />
      <View style={s.miniHlBar} />
    </View>
  )
}

function MiniMock({ variant, ar }: { variant: 'list' | 'product' | 'home'; ar: boolean }) {
  if (variant === 'list') {
    return (
      <View style={s.mini}>
        <HlRow ar={ar} />
        <View style={s.miniRow} />
        <View style={s.miniRow} />
        <View style={s.miniRow} />
        <View style={s.miniRow} />
      </View>
    )
  }
  if (variant === 'product') {
    return (
      <View style={s.mini}>
        <View style={s.miniImg} />
        <View style={[s.miniRow, { height: 10, width: '70%' }, ar ? { alignSelf: 'flex-end' } : null]} />
        <View style={[s.miniStrip, row(ar)]}>
          <View style={[s.miniTile, s.miniTileHl]} />
          <View style={s.miniTile} />
          <View style={s.miniTile} />
        </View>
      </View>
    )
  }
  return (
    <View style={s.mini}>
      <View style={[s.miniRow, { height: 30 }]} />
      <View style={[s.miniStrip, row(ar)]}>
        <View style={[s.miniTile, s.miniTileHl, { height: 44 }]} />
        <View style={[s.miniTile, { height: 44 }]} />
      </View>
      <View style={s.miniRow} />
    </View>
  )
}

export function PriceTicket(props: {
  ar: boolean
  label: string
  amount: string
  currency?: string
  perDay?: string
  perDayUnit: string
  days: number
  dayUnit: string
  hint: string
}) {
  const { ar, days } = props
  const chips = Array.from({ length: Math.max(1, Math.min(days, 7)) }, (_, i) => i + 1)
  return (
    <View style={s.ticket}>
      <Grad
        rx={24}
        x2="1"
        y2="1"
        stops={[
          { offset: '0', color: '#FFD84D' },
          { offset: '0.55', color: '#F5B800' },
          { offset: '1', color: '#e0a400' },
        ]}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        {Array.from({ length: 24 }, (_, i) => (
          <Line
            key={i}
            x1={i * 22 - 200}
            y1={0}
            x2={i * 22}
            y2={200}
            stroke="#FFFFFF"
            strokeOpacity={0.08}
            strokeWidth={8}
          />
        ))}
      </Svg>

      <View style={s.ticketTop}>
        <Text style={[s.ticketLabel, txt(ar)]}>{props.label}</Text>
        <View style={[row(ar), { alignItems: 'baseline', gap: 6 }]}>
          <Text style={s.ticketAmt}>{props.amount}</Text>
          {props.currency ? <Text style={s.ticketCur}>{props.currency}</Text> : null}
        </View>
        {props.perDay ? (
          <View style={[s.perBadge, side(ar, 'end', 18)]}>
            <Text style={s.perNum}>{props.perDay}</Text>
            <Text style={s.perUnit}>{props.perDayUnit}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.perf}>
        <View style={[s.hole, { left: -32 }]} />
        <View style={[s.hole, { right: -32 }]} />
      </View>

      <View style={s.ticketBottom}>
        <View style={[s.dayChips, row(ar)]}>
          {chips.map((d) => (
            <View key={d} style={s.dayChip}>
              <Text style={s.dayNum}>{d}</Text>
              <Text style={s.dayLbl}>{props.dayUnit}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.ticketHint, txt(ar)]}>{props.hint}</Text>
      </View>
    </View>
  )
}

export function ExtendTimeline(props: {
  ar: boolean
  elapsed: number
  left: number
  added: number
  legendElapsed: string
  legendLeft: string
  legendAdded: string
  note: string
}) {
  const { ar } = props
  return (
    <View>
      <View style={[s.timeline, row(ar)]}>
        {props.elapsed > 0 ? <View style={[s.segElapsed, { flex: props.elapsed }]} /> : null}
        {props.left > 0 ? <View style={[s.segLeft, { flex: props.left }]} /> : null}
        <View style={[s.segAdd, { flex: Math.max(1, props.added) }]} />
      </View>
      <View style={[s.legendRow, row(ar)]}>
        <Text style={s.legendText}>{props.legendElapsed}</Text>
        <Text style={s.legendText}>{props.legendLeft}</Text>
        <Text style={[s.legendText, { fontFamily: fonts.bold, color: P.y2 }]}>{props.legendAdded}</Text>
      </View>
      <BoostNote ar={ar} icon="⏱" text={props.note} />
    </View>
  )
}

// ── Payment method card (Android) ───────────────────────────────────────

export function PayMethodCard(props: {
  ar: boolean
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  note: string
  warn?: string | null
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { ar, selected, disabled } = props
  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[s.payCard, selected && s.payCardOn, disabled && { opacity: 0.5 }]}
    >
      <View style={[row(ar), { alignItems: 'center', gap: 12 }]}>
        <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioInner} /> : null}</View>
        <Ionicons name={props.icon} size={20} color={selected ? P.y2 : P.g400} />
        <View style={{ flex: 1 }}>
          <Text style={[s.payTitle, txt(ar)]}>{props.title}</Text>
          <Text style={[s.payNote, txt(ar)]}>{props.note}</Text>
          {props.warn ? <Text style={[s.payWarn, txt(ar)]}>{props.warn}</Text> : null}
        </View>
      </View>
    </Pressable>
  )
}

// ── Sticky CTA dock ──────────────────────────────────────────────────────

export function PromoDock(props: {
  ar: boolean
  label: string
  price: string
  trust: string
  loading?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { ar, loading, disabled } = props
  const insets = useSafeAreaInsets()
  const shine = useLoop(1680, { rest: 1120 })
  const [w, setW] = useState(0)
  const translateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-80, w + 20] })
  return (
    <View style={[s.dock, { paddingBottom: 12 + insets.bottom }]}>
      <Pressable
        onPress={props.onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={props.label}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={({ pressed }) => [
          s.cta,
          row(ar),
          (disabled || loading) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <Grad
          rx={20}
          x2="1"
          y2="0"
          stops={[
            { offset: '0', color: P.y },
            { offset: '1', color: P.y2 },
          ]}
        />
        {w > 0 && !disabled && !loading ? (
          <Animated.View pointerEvents="none" style={[s.shine, { transform: [{ translateX }, { skewX: '-20deg' }] }]} />
        ) : null}
        {loading ? (
          <ActivityIndicator color={P.dk} style={{ flex: 1 }} />
        ) : (
          <>
            <Text style={[s.ctaText, txt(ar)]} numberOfLines={1}>
              {props.label}
            </Text>
            <View style={s.ctaPrice}>
              <Text style={s.ctaPriceText}>{props.price}</Text>
            </View>
          </>
        )}
      </Pressable>
      <Text style={[s.trust, txt(ar, 'center')]}>{props.trust}</Text>
    </View>
  )
}

// ── styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  stage: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: P.ink,
    direction: 'ltr',
  },
  beamWrap: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floorGlow: {
    position: 'absolute',
    bottom: 58,
    alignSelf: 'center',
    width: 300,
    height: 60,
  },
  spark: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.y2,
  },
  centerAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ghostRow: {
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  ghostSquare: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ghostBar: {
    width: 110,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroCard: {
    width: 300,
    borderRadius: 22,
    padding: 14,
    borderWidth: 2,
    borderColor: P.y,
    backgroundColor: '#FFFFFF',
    shadowColor: P.y,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  crown: {
    position: 'absolute',
    top: -17,
    fontSize: 24,
    zIndex: 2,
  },
  rankPill: {
    position: 'absolute',
    top: -12,
    zIndex: 2,
    backgroundColor: P.dk,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: P.y,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  rankPillText: {
    fontFamily: fonts.black,
    fontSize: 12,
    color: P.y,
  },
  heroRow: {
    alignItems: 'center',
    gap: 12,
  },
  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: P.dk,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogoImg: {
    width: 52,
    height: 52,
  },
  heroInitial: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: P.y,
  },
  heroName: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: P.dk,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: P.g700,
  },
  featPill: {
    backgroundColor: P.y,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  featPillText: {
    fontFamily: fonts.black,
    fontSize: 11.5,
    color: P.dk,
  },
  stageCopy: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  stageH2: {
    fontFamily: fonts.black,
    fontSize: 27,
    lineHeight: 38,
    color: '#FFFFFF',
  },
  stageP: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: P.g400,
    marginTop: 4,
  },
  livePill: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  liveDotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveHalo: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.live,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.live,
  },
  liveText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: P.liveText,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBig: {
    fontFamily: fonts.black,
    fontSize: 64,
    lineHeight: 76,
    color: '#ffe9a0',
  },
  ringSmall: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: P.g400,
  },
  section: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: P.line,
    direction: 'ltr',
  },
  sectionHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  sectionSide: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: P.g500,
  },
  eqRow: {
    alignItems: 'center',
    gap: 6,
  },
  eqNode: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: P.glass,
    borderWidth: 1,
    borderColor: P.line,
    alignItems: 'center',
  },
  eqNodeWin: {
    backgroundColor: P.y,
    borderColor: P.y,
  },
  eqEmoji: {
    fontSize: 22,
    lineHeight: 30,
  },
  eqNum: {
    fontFamily: fonts.black,
    fontSize: 20,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  eqLabel: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: P.g400,
  },
  eqOp: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: P.y,
  },
  boost: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,184,0,0.08)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,184,0,0.45)',
    padding: 12,
    gap: 10,
    alignItems: 'center',
  },
  boostIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: P.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    lineHeight: 21,
    color: P.boostText,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  bubbleText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: P.dk,
  },
  axisRow: {
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: P.g500,
  },
  carousel: {
    marginHorizontal: -18,
  },
  carouselContent: {
    paddingHorizontal: 18,
    gap: 10,
  },
  placeCard: {
    width: 150,
    borderRadius: 18,
    padding: 10,
    backgroundColor: P.glass,
    borderWidth: 1,
    borderColor: P.line,
  },
  mini: {
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f2f4f8',
    padding: 8,
    gap: 5,
    marginBottom: 8,
    direction: 'ltr',
  },
  miniRow: {
    height: 20,
    borderRadius: 6,
    backgroundColor: '#dfe3ea',
  },
  miniRowHl: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: P.y,
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  miniHlSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: P.dk,
  },
  miniHlBar: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.y,
  },
  miniImg: {
    height: 58,
    borderRadius: 8,
    backgroundColor: '#dfe3ea',
  },
  miniStrip: {
    gap: 5,
  },
  miniTile: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#dfe3ea',
  },
  miniTileHl: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: P.y,
  },
  placeTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  placeSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: P.g500,
  },
  ticket: {
    margin: 14,
    borderRadius: 24,
    overflow: 'hidden',
    direction: 'ltr',
  },
  ticketTop: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  ticketLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: P.dk,
    opacity: 0.75,
  },
  ticketAmt: {
    fontFamily: fonts.black,
    fontSize: 46,
    lineHeight: 60,
    color: P.dk,
  },
  ticketCur: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: P.dk,
  },
  perBadge: {
    position: 'absolute',
    top: 20,
    backgroundColor: P.dk,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  perNum: {
    fontFamily: fonts.black,
    fontSize: 20,
    lineHeight: 26,
    color: P.y,
  },
  perUnit: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: P.y,
  },
  perf: {
    height: 0,
    marginHorizontal: 18,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(26,37,64,0.35)',
  },
  hole: {
    position: 'absolute',
    top: -15,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: P.ink,
  },
  ticketBottom: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  dayChips: {
    gap: 6,
  },
  dayChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 7,
    backgroundColor: P.dk,
    alignItems: 'center',
  },
  dayNum: {
    fontFamily: fonts.black,
    fontSize: 15,
    lineHeight: 22,
    color: P.y,
  },
  dayLbl: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: P.y,
  },
  ticketHint: {
    marginTop: 10,
    fontFamily: fonts.bold,
    fontSize: 12,
    color: P.dk,
    opacity: 0.8,
  },
  timeline: {
    height: 16,
    borderRadius: 10,
    overflow: 'hidden',
    gap: 2,
  },
  segElapsed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  segLeft: {
    backgroundColor: P.y,
  },
  segAdd: {
    backgroundColor: 'rgba(245,184,0,0.3)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: P.y,
    borderRadius: 4,
  },
  legendRow: {
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: P.g400,
  },
  payCard: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: P.glass,
    borderWidth: 1.5,
    borderColor: P.line,
    direction: 'ltr',
  },
  payCardOn: {
    borderColor: P.y,
    backgroundColor: 'rgba(245,184,0,0.08)',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: P.g500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: P.y,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.y,
  },
  payTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  payNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.g400,
  },
  payWarn: {
    marginTop: 2,
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    color: '#fca5a5',
  },
  dock: {
    backgroundColor: P.ink,
    borderTopWidth: 1,
    borderTopColor: P.line,
    paddingTop: 12,
    paddingHorizontal: 14,
    direction: 'ltr',
  },
  cta: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    minHeight: 58,
    shadowColor: P.y,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ctaText: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 18,
    color: P.dk,
  },
  ctaPrice: {
    backgroundColor: 'rgba(26,37,64,0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginStart: 10,
  },
  ctaPriceText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: P.dk,
  },
  trust: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: P.g500,
  },
})
