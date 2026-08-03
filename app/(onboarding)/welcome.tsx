import { useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, spacing } from '@/constants/theme'
import { Button } from '@/components/ui/Button'
import { slide1Xml } from '@/assets/onboarding/slide-1'
import { slide2Xml } from '@/assets/onboarding/slide-2'
import { slide3Xml } from '@/assets/onboarding/slide-3'

const ONBOARDED_KEY = 'vatix_onboarded'

export default function OnboardingScreen() {
  const { t } = useLocale()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const slides = [
    { xml: slide1Xml, title: t.onboarding.slide1.title, desc: t.onboarding.slide1.desc },
    { xml: slide2Xml, title: t.onboarding.slide2.title, desc: t.onboarding.slide2.desc },
    { xml: slide3Xml, title: t.onboarding.slide3.title, desc: t.onboarding.slide3.desc },
  ]
  const lastIndex = slides.length - 1
  const isLast = index === lastIndex

  const artSize = Math.min(width * 0.78, 340)

  async function finish() {
    await SecureStore.setItemAsync(ONBOARDED_KEY, '1')
    router.replace('/(tabs)/home')
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(lastIndex, next))
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true })
    setIndex(clamped)
  }

  function onNext() {
    if (isLast) {
      finish()
    } else {
      goTo(index + 1)
    }
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x
    const i = Math.round(x / width)
    if (i !== index) setIndex(i)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.skipRow}>
        {!isLast ? (
          <Pressable
            onPress={finish}
            hitSlop={10}
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.skipText}>{t.onboarding.skip}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ direction: 'ltr' }}
      >
        {slides.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.art}>
              <SvgXml xml={s.xml} width={artSize} height={artSize} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.desc}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          label={isLast ? t.onboarding.getStarted : t.onboarding.next}
          variant="y"
          size="lg"
          onPress={onNext}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  skipRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'flex-end',
    minHeight: 40,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g600,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  copy: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 24,
    lineHeight: 32,
    color: colors.dk,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.g600,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.g300,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.y,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
})
