import React from 'react'
import { Linking, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Product } from '@/lib/api'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { track, trackProductPhoneClick, trackProductWhatsappClick } from '@/lib/analytics'
import { bumpEngagement } from '@/lib/rate-app-engagement'
import { buildWaLink } from '@/lib/whatsapp'
import { StartChatButton } from '@/components/StartChatButton'
import { darkColors, fonts, lightColors, radius, type ThemeColors } from '@/constants/theme'

const WA_GREEN = '#25D366'

interface CardContactProps {
  product: Product
  // Grid cards are too narrow for labels; row cards show icon + label.
  iconOnly?: boolean
  // 'round': fixed-size circular icon buttons for the row card footer.
  variant?: 'pill' | 'round'
  style?: ViewStyle
}

// Call / WhatsApp / chat row at the foot of a product card. Same rules and
// tracking as the details-page action bar: phone + WhatsApp only when the
// listing shows the phone and the owner isn't an expired store; chat always.
export function CardContact({ product, iconOnly = false, variant = 'pill', style }: CardContactProps) {
  const { locale } = useLocale()
  const { user } = useAuth()
  const { mode, colors } = useTheme()
  const styles = themedStyles[mode]
  const ar = locale === 'ar'

  const owner = product.owner
  if (!owner?.id || user?.id === owner.id) return null

  const isOwnerExpired = owner.type === 'store' && !!owner.subscriptionExpired
  const phone = product.showPhone && !isOwnerExpired ? (owner.contactPhone ?? null) : null
  const waLink = buildWaLink(phone, product.title, product.price, product.slug ?? product.id, ar)

  const callLabel = ar ? 'اتصال' : 'Call'
  const waLabel = ar ? 'واتساب' : 'WhatsApp'

  const onCall = () => {
    trackProductPhoneClick(product.id)
    void track({ name: 'contact_seller', params: { product_id: product.id, channel: 'phone' } })
    void bumpEngagement('inquiry')
    Linking.openURL(`tel:${phone}`).catch(() => {})
  }

  const onWhatsapp = () => {
    if (!waLink) return
    trackProductWhatsappClick(product.id)
    void track({ name: 'contact_seller', params: { product_id: product.id, channel: 'whatsapp' } })
    void bumpEngagement('inquiry')
    Linking.openURL(waLink).catch(() => {})
  }

  if (variant === 'round') {
    return (
      <View style={[styles.roundRow, style]}>
        {phone ? (
          <Pressable
            onPress={onCall}
            style={({ pressed }) => [styles.round, styles.roundCall, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={callLabel}
            hitSlop={4}
          >
            <Ionicons name="call" size={19} color={mode === 'dark' ? colors.dk : colors.white} />
          </Pressable>
        ) : null}
        {waLink ? (
          <Pressable
            onPress={onWhatsapp}
            style={({ pressed }) => [styles.round, styles.waBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={waLabel}
            hitSlop={4}
          >
            <Ionicons name="logo-whatsapp" size={21} color="#fff" />
          </Pressable>
        ) : null}
        <StartChatButton
          recipientId={owner.id}
          productId={product.id}
          iconOnly
          iconColor={mode === 'dark' ? colors.text : colors.dk}
          style={styles.roundChat}
        />
      </View>
    )
  }

  return (
    <View style={[styles.row, style]}>
      {phone ? (
        <Pressable
          onPress={onCall}
          style={({ pressed }) => [styles.btn, styles.callBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={callLabel}
          hitSlop={4}
        >
          <Ionicons name="call" size={16} color={colors.dk} />
          {iconOnly ? null : (
            <Text style={[styles.label, styles.callLabel]} numberOfLines={1}>{callLabel}</Text>
          )}
        </Pressable>
      ) : null}
      {waLink ? (
        <Pressable
          onPress={onWhatsapp}
          style={({ pressed }) => [styles.btn, styles.waBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={waLabel}
          hitSlop={4}
        >
          <Ionicons name="logo-whatsapp" size={17} color="#fff" />
          {iconOnly ? null : (
            <Text style={[styles.label, styles.waLabel]} numberOfLines={1}>{waLabel}</Text>
          )}
        </Pressable>
      ) : null}
      {/* Chat alone keeps its label even on grid cards — there's room for it. */}
      <StartChatButton
        recipientId={owner.id}
        productId={product.id}
        size="sm"
        iconOnly={iconOnly && !!phone}
        style={styles.chatBtn}
      />
    </View>
  )
}

const ROUND = 44

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundCall: {
    backgroundColor: dark ? colors.y : colors.dk,
  },
  roundChat: {
    width: ROUND,
    height: ROUND,
    minHeight: ROUND,
    borderRadius: ROUND / 2,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: dark ? colors.text : colors.dk,
    shadowOpacity: 0,
    elevation: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    flex: 1,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  callBtn: {
    backgroundColor: colors.y,
  },
  waBtn: {
    backgroundColor: WA_GREEN,
  },
  chatBtn: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    flexShrink: 1,
  },
  callLabel: {
    color: colors.dk,
  },
  waLabel: {
    color: '#fff',
  },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
