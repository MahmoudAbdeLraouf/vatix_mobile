import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, spacing } from '@/constants/theme'

// JS replacement for the native stack header on Bro screens. The native header
// ignores our JS `direction`, so in Arabic it pinned the title + back arrow to
// the left. Here the row is laid out explicitly: back on the start side, title
// right-aligned in Arabic.
export function BroStackHeader({ title }: { title: string }) {
  const { isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <View style={[styles.row, { direction: 'ltr', flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name={isRtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.dk} />
        </Pressable>
        <Text
          style={[styles.title, { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </View>
  )
}

/** Stack.Screen options for Bro screens — `options={broHeader(title)}`. */
export function broHeader(title: string) {
  return { headerShown: true, header: () => <BroStackHeader title={title} /> }
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.g200,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.extraBold, fontSize: 17, color: colors.dk },
})
