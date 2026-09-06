import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { getStores, Store } from '@/lib/api'
import { StoreCard } from '@/components/StoreCard'
import { MessagesBell } from '@/components/MessagesBell'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

const PLUS_RATIO = 0.2

function isPlus(s: { type?: string | null }): boolean {
  const t = (s.type ?? '').toLowerCase()
  return t === 'store_plus'
}

function interleavePlus<T extends { type?: string | null }>(stores: T[]): T[] {
  const plus = stores.filter(isPlus)
  const rest = stores.filter(s => !isPlus(s))
  const out: T[] = []
  let pi = 0, ri = 0
  while (pi < plus.length || ri < rest.length) {
    const placed = out.length
    const takePlus =
      ri >= rest.length ||
      (pi < plus.length && pi / (placed + 1) < PLUS_RATIO)
    if (takePlus) { out.push(plus[pi++]) } else { out.push(rest[ri++]) }
  }
  return out
}

export default function StoresScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const [stores, setStores] = useState<Store[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getStores()
      .then(list => setStores(interleavePlus(list)))
      .catch(e => setError(e as Error))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Memoized so FlatList's `data` prop stays referentially stable across
  // unrelated re-renders (header language toggle, notif icon presses etc.) —
  // otherwise every render forces the virtualizer to recompute cell layouts.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return stores
    return stores.filter(s => s.storeProfile?.name?.toLowerCase().includes(q))
  }, [stores, search])

  const renderStore = useCallback(
    ({ item }: { item: Store }) => <StoreCard store={item} style={styles.gridItem} />,
    [],
  )

  return (
    <SafeAreaView
      style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t.stores}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            >
              <Ionicons name="globe-outline" size={20} color={colors.white} />
            </TouchableOpacity>
            <MessagesBell color={colors.white} size={20} style={styles.notifBtn} />
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => router.push('/dashboard/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.g500} />
          <TextInput
            style={[styles.searchInput, { textAlign: 'auto' }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={colors.g400}
          />
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.list}>
            <SkeletonGrid count={6} />
          </View>
        ) : error ? (
          <ErrorState kind="network" onRetry={load} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={s => String(s.id)}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<EmptyState title={t.noResults} subtitle={t.notFoundHint} />}
            renderItem={renderStore}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dk },
  header: {
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  content: {
    flex: 1,
    backgroundColor: colors.g100,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.white,
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    gap: spacing.lg,
    justifyContent: 'flex-start',
  },
  // Hoisted so `renderStore`'s style prop is a stable reference —
  // an inline `{ flex: 1 }` object would defeat StoreCard's React.memo.
  gridItem: {
    flex: 1,
  },
})
