import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { Notification } from '@/lib/api'
import { authFetch, authPatch } from '@/lib/auth'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

export default function NotificationsScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await authFetch<Notification[]>('/notifications')
      setNotifications(data ?? [])
    } catch (e) {
      setError(e as Error)
      setNotifications([])
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

  async function markAllRead() {
    await authPatch('/notifications/read-all', {})
    setNotifications(prev => (prev ? prev.map(n => ({ ...n, isRead: true })) : prev))
  }

  async function markRead(id: number) {
    await authPatch(`/notifications/${id}/read`, {})
    setNotifications(prev =>
      prev ? prev.map(n => (n.id === id ? { ...n, isRead: true } : n)) : prev,
    )
  }

  const unreadCount = (notifications ?? []).filter(n => !n.isRead).length

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, dirContainer]}>
        <Pressable style={styles.markAllBtn} onPress={markAllRead} disabled={unreadCount === 0}>
          <Text style={[styles.markAllText, unreadCount === 0 && { opacity: 0.4 }]}>
            {t.markAllRead}
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.notifications}</Text>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons
            name={locale === 'ar' ? 'chevron-forward-outline' : 'chevron-back-outline'}
            size={22}
            color={colors.white}
          />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {notifications === null && !error ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <ErrorState kind="network" onRetry={load} />
          </View>
        ) : (
          <FlatList
            data={notifications ?? []}
            keyExtractor={item => String(item.id)}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.y} />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<Ionicons name="notifications-off-outline" size={28} color={colors.g400} />}
                title={t.notifications}
                subtitle={t.noNotifications}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.item,
                  dirContainer,
                  !item.isRead && styles.itemUnread,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => markRead(item.id)}
              >
                <View style={[styles.iconWrap, !item.isRead && styles.iconWrapUnread]}>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={item.isRead ? colors.g400 : colors.dk}
                  />
                </View>
                <View style={styles.itemContent}>
                  <View style={[styles.itemTop, dirContainer]}>
                    <Text style={[styles.itemTitle, dirStyle, !item.isRead && styles.itemTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.dot} />}
                  </View>
                  <Text style={[styles.itemBody, dirStyle]} numberOfLines={2}>{item.body}</Text>
                  <Text style={[styles.itemDate, dirStyle]}>
                    {new Date(item.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-EG')}
                  </Text>
                </View>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={(notifications ?? []).length === 0 ? styles.emptyContainer : styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dk },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.y,
    textAlign: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
  },

  content: {
    flex: 1,
    backgroundColor: colors.g100,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    overflow: 'hidden',
  },
  skeletonWrap: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  list: { paddingBottom: spacing.xl },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  itemUnread: { backgroundColor: '#fffcee' },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconWrapUnread: {
    backgroundColor: colors.yl,
  },

  itemContent: { flex: 1 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  itemTitle: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
  },
  itemTitleUnread: {
    color: colors.g900,
    fontFamily: fonts.bold,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.y,
    marginStart: spacing.xs,
  },
  itemBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    lineHeight: 19,
    marginBottom: 4,
  },
  itemDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g400,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.g200,
    marginStart: spacing.lg + 42 + spacing.md,
  },

  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
})
