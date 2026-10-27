import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { imgUrl, type ConversationListItem } from '@/lib/api'
import { authFetch } from '@/lib/auth'
import { BroAvatar, BroBadge } from '@/components/bro/BroAvatar'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

type Filter = 'all' | 'unread' | 'stores' | 'people'

function timeLabel(iso: string, ar: boolean): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return ar ? 'الآن' : 'now'
  if (diffMin < 60) return `${diffMin}${ar ? ' د' : 'm'}`

  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  const y = new Date()
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return ar ? 'أمس' : 'Yest.'

  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays < 7) {
    return d.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'short' })
  }
  return d.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })
}

function MessageSkeletonItem() {
  const styles = useStyles()
  return (
    <View style={styles.skelItem}>
      <Skeleton width={52} height={52} radius={16} />
      <View style={styles.skelBody}>
        <View style={styles.skelTop}>
          <Skeleton width="55%" height={14} />
          <Skeleton width={28} height={11} />
        </View>
        <Skeleton width="35%" height={14} radius={6} style={styles.skelChip} />
        <Skeleton width="80%" height={12} style={styles.skelPreview} />
      </View>
    </View>
  )
}

interface FilterChipProps {
  label: string
  count: number
  active: boolean
  onPress: () => void
  tone?: 'default' | 'warn'
}

function FilterChip({ label, count, active, onPress, tone = 'default' }: FilterChipProps) {
  const styles = useStyles()
  const isWarn = tone === 'warn' && count > 0
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        isWarn && !active && styles.chipWarn,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          active && styles.chipLabelActive,
          isWarn && !active && styles.chipLabelWarn,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        style={[
          styles.chipBadge,
          active && styles.chipBadgeActive,
          isWarn && !active && styles.chipBadgeWarn,
        ]}
      >
        <Text
          style={[
            styles.chipBadgeText,
            active && styles.chipBadgeTextActive,
            isWarn && !active && styles.chipBadgeTextWarn,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  )
}

export default function MessagesScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  // LocaleProvider applies `direction: 'rtl'` at the tree root. Under inherited
  // RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve visually
  // BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so the first
  // child anchors to the physical right. `colDir` restores RTL context inside
  // those rows so nested text uses `textAlign: 'auto'` = start alignment.
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const colDir = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const trailAlign = {
    alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
  }
  const { user } = useAuth()

  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const searchRef = useRef<TextInput>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await authFetch<ConversationListItem[]>('/conversations')
      setConversations(data ?? [])
    } catch (e) {
      setError(e as Error)
      setConversations([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const counts = useMemo(() => {
    const list = conversations ?? []
    let unread = 0
    let stores = 0
    let people = 0
    for (const c of list) {
      if ((c.unreadCount ?? 0) > 0) unread++
      if (c.otherUser?.isStore) stores++
      else people++
    }
    return { all: list.length, unread, stores, people }
  }, [conversations])

  const filtered = useMemo(() => {
    const list = conversations ?? []
    const q = query.trim().toLowerCase()
    return list.filter((c) => {
      if (filter === 'unread' && !(c.unreadCount ?? 0)) return false
      if (filter === 'stores' && !c.otherUser?.isStore) return false
      if (filter === 'people' && c.otherUser?.isStore) return false
      if (!q) return true
      const name = (c.otherUser?.isBro ? t.bro.name : (c.otherUser?.displayName ?? '')).toLowerCase()
      const product = (c.product?.title ?? '').toLowerCase()
      const preview = (c.lastMessage?.content ?? '').toLowerCase()
      return name.includes(q) || product.includes(q) || preview.includes(q)
    })
  }, [conversations, query, filter, t])

  const heroSubtitle = useMemo(() => {
    if (conversations === null || error) return ''
    if (counts.all === 0) return ''
    if (ar) {
      return counts.unread > 0
        ? `${counts.unread} غير مقروءة من ${counts.all}`
        : `${counts.all} محادثة`
    }
    return counts.unread > 0
      ? `${counts.unread} unread of ${counts.all}`
      : `${counts.all} conversation${counts.all === 1 ? '' : 's'}`
  }, [ar, conversations, error, counts])

  const showToolbar = conversations !== null && !error && counts.all > 0
  const showSearchEmpty = filtered.length === 0 && counts.all > 0

  return (
    <DashboardLayout title={t.messages} scroll={false} contentPadding={false}>
      <View style={[styles.container]}>
        {/* Hero */}
        <View style={[styles.hero]}>
          <View style={[styles.heroRow]}>
            <Text
              style={[
                styles.h2,
                dirStyle,
              ]}
            >
              {ar ? 'المحادثات' : 'Messages'}
            </Text>
            {counts.unread > 0 ? (
              <View style={styles.heroPill}>
                <View style={styles.heroDot} />
                <Text style={styles.heroPillText}>
                  {counts.unread} {ar ? 'جديد' : 'new'}
                </Text>
              </View>
            ) : null}
          </View>
          {heroSubtitle ? (
            <Text
              style={[
                styles.heroSub,
                dirStyle,
              ]}
            >
              {heroSubtitle}
            </Text>
          ) : null}
        </View>

        {/* Toolbar: search + filter chips */}
        {showToolbar ? (
          <View style={styles.toolbar}>
            <Pressable
              onPress={() => searchRef.current?.focus()}
              style={[styles.searchBox]}
            >
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                ref={searchRef}
                value={query}
                onChangeText={setQuery}
                placeholder={ar ? 'ابحث في المحادثات...' : 'Search conversations...'}
                placeholderTextColor={colors.subtle}
                style={[styles.searchInput, dirStyle]}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.searchClear}>
                  <Ionicons name="close-circle" size={18} color={colors.subtle} />
                </Pressable>
              ) : null}
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chipsRow]}
              style={styles.chipsScroll}
            >
              <FilterChip
                label={ar ? 'الكل' : 'All'}
                count={counts.all}
                active={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              <FilterChip
                label={ar ? 'غير مقروءة' : 'Unread'}
                count={counts.unread}
                active={filter === 'unread'}
                tone="warn"
                onPress={() => setFilter('unread')}
              />
              <FilterChip
                label={ar ? 'المتاجر' : 'Stores'}
                count={counts.stores}
                active={filter === 'stores'}
                onPress={() => setFilter('stores')}
              />
              <FilterChip
                label={ar ? 'الأشخاص' : 'People'}
                count={counts.people}
                active={filter === 'people'}
                onPress={() => setFilter('people')}
              />
            </ScrollView>
          </View>
        ) : null}

        {/* Body */}
        {conversations === null && !error ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <MessageSkeletonItem key={i} />
            ))}
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <ErrorState kind="network" onRetry={load} />
          </View>
        ) : counts.all === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<Ionicons name="chatbubbles-outline" size={28} color={colors.subtle} />}
              title={t.noConversations}
              subtitle={
                ar
                  ? 'ابدأ محادثة من صفحة أي منتج للتواصل مع البائع.'
                  : 'Start a conversation from any product page to reach the seller.'
              }
              actionLabel={t.browseProducts}
              onAction={() => router.push('/(tabs)/products')}
            />
          </View>
        ) : showSearchEmpty ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<Ionicons name="search-outline" size={26} color={colors.subtle} />}
              title={t.noResults}
              subtitle={
                ar
                  ? 'جرّب كلمات مختلفة أو غيّر نوع التصفية.'
                  : 'Try different keywords or change the filter.'
              }
              actionLabel={ar ? 'مسح التصفية' : 'Clear filters'}
              onAction={() => {
                setQuery('')
                setFilter('all')
              }}
            />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.y} />
            }
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isBro = !!item.otherUser?.isBro
              const name = isBro ? t.bro.name : (item.otherUser?.displayName ?? t.profile)
              const isOwnLast = item.lastMessage?.senderId === user?.id
              const rawPreview = item.lastMessage?.content ?? ''
              const preview = rawPreview
                ? isOwnLast
                  ? `${t.you}: ${rawPreview}`
                  : rawPreview
                : ar
                ? 'لا توجد رسائل بعد'
                : 'No messages yet'
              const time = timeLabel(item.updatedAt, ar)
              const logo = imgUrl(item.otherUser?.logo)
              const unread = item.unreadCount ?? 0
              const productImg = imgUrl(item.product?.image)
              const isStore = !!item.otherUser?.isStore

              return (
                <Pressable
                  onPress={() => router.push(`/dashboard/messages/${item.id}`)}
                  style={({ pressed }) => [
                    styles.item,
                    unread > 0 && styles.itemUnread,
                    pressed && styles.itemPressed,
                  ]}
                >
                  {isBro ? (
                    <BroAvatar size={52} radius={16} />
                  ) : (
                  <View style={styles.avatarWrap}>
                    <View style={[styles.avatar, isStore ? styles.avatarStore : styles.avatarUser]}>
                      {logo ? (
                        <Image source={{ uri: logo }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitial}>
                          {(name || '?').trim().charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.typeBadge,
                        ar ? { left: -2 } : { right: -2 },
                        isStore ? styles.typeBadgeStore : styles.typeBadgeUser,
                      ]}
                    >
                      <Ionicons
                        name={isStore ? 'storefront' : 'person'}
                        size={9}
                        color={isStore ? colors.dk : colors.white}
                      />
                    </View>
                  </View>
                  )}

                  <View style={styles.itemBody}>
                    <View style={[styles.itemTop]}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.name,
                          unread > 0 && styles.nameUnread,
                          dirStyle,
                        ]}
                      >
                        {name}
                      </Text>
                      {isBro ? <BroBadge label={t.bro.badge} /> : null}
                      <View style={styles.timeWrap}>
                        {unread > 0 ? <View style={styles.timeDot} /> : null}
                        <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{time}</Text>
                      </View>
                    </View>

                    {item.product?.title ? (
                      <View style={[styles.productChip]}>
                        {productImg ? (
                          <Image source={{ uri: productImg }} style={styles.productThumb} />
                        ) : (
                          <View style={styles.productThumbFallback}>
                            <Ionicons name="cube-outline" size={12} color={colors.yd} />
                          </View>
                        )}
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.productTitle,
                            dirStyle,
                          ]}
                        >
                          {item.product.title}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.generalChip]}>
                        <Ionicons name="chatbubble-ellipses-outline" size={10} color={colors.muted} />
                        <Text
                          style={[
                            styles.generalChipText,
                            dirStyle,
                          ]}
                        >
                          {t.generalChat}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.itemBottom]}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.preview,
                          unread > 0 && styles.previewUnread,
                          dirStyle,
                        ]}
                      >
                        {preview}
                      </Text>
                      {unread > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              )
            }}
          />
        )}
      </View>
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors, dark = false) => StyleSheet.create({
  container: { flex: 1, paddingTop: spacing.md },

  hero: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm + 2,
    gap: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  h2: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: colors.heading,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.fab,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.y,
  },
  heroPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },

  toolbar: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md - 2,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  searchClear: {
    padding: 2,
  },

  chipsScroll: {
    marginHorizontal: -spacing.md,
  },
  chipsRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.fab,
    borderColor: colors.fab,
  },
  chipWarn: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
  },
  chipLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.text,
  },
  chipLabelActive: {
    color: colors.white,
  },
  chipLabelWarn: {
    color: colors.yd,
  },
  chipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  chipBadgeWarn: {
    backgroundColor: colors.y,
  },
  chipBadgeText: {
    fontFamily: fonts.black,
    fontSize: 10,
    color: colors.muted,
  },
  chipBadgeTextActive: {
    color: colors.white,
  },
  chipBadgeTextWarn: {
    color: colors.dk,
  },

  skeletonWrap: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  skelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  skelBody: {
    flex: 1,
    gap: 6,
  },
  skelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  skelChip: {
    marginTop: 2,
  },
  skelPreview: {
    marginTop: 2,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },

  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: 2,
  },
  sep: { height: spacing.sm },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    overflow: 'hidden',
    ...(dark ? null : shadow.ss),
  },
  itemUnread: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
    ...(dark ? null : shadow.sm),
  },
  itemPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },

  avatarWrap: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarStore: {
    backgroundColor: colors.yellowBg,
    borderColor: colors.y,
  },
  avatarUser: {
    backgroundColor: colors.placeholder,
    borderColor: colors.dot,
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarInitial: {
    fontFamily: fonts.black,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  typeBadgeStore: {
    backgroundColor: colors.y,
  },
  typeBadgeUser: {
    backgroundColor: colors.fab,
  },

  itemBody: { flex: 1, minWidth: 0 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
  },
  nameUnread: { fontFamily: fonts.black },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.y,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.subtle,
  },
  timeUnread: {
    fontFamily: fonts.bold,
    color: colors.yd,
  },

  productChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: colors.yellowBg,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
    maxWidth: '100%',
  },
  productThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    resizeMode: 'cover',
  },
  productThumbFallback: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTitle: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.yd,
  },
  generalChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: colors.placeholder,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  generalChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.muted,
  },

  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 3,
  },
  preview: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  previewUnread: {
    fontFamily: fonts.semiBold,
    color: colors.heading,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.black,
    fontSize: 10,
    color: colors.white,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
