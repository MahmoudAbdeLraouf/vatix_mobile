import React, { useCallback, useEffect, useState } from 'react'
import {
  ScrollView,
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
import { getFeaturedStores, getStores, Store } from '@/lib/api'
import { StoreCard } from '@/components/StoreCard'
import { MessagesBell } from '@/components/MessagesBell'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

const FEATURED_LIMIT = 2
const RANKED_LIMIT = 8

export default function StoresScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const [featured, setFeatured] = useState<Store[]>([])
  const [ranked, setRanked] = useState<Store[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const featuredList = await getFeaturedStores({ limit: FEATURED_LIMIT }).catch(() => [] as Store[])
      const rankedList = await getStores({
        limit: RANKED_LIMIT,
        excludeIds: featuredList.map(s => s.id),
      })
      setFeatured(featuredList)
      setRanked(rankedList)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const matches = (s: Store) =>
    s.storeProfile?.name?.toLowerCase().includes(search.toLowerCase())
  const q = search.trim()
  const filteredFeatured = q ? featured.filter(matches) : featured
  const filteredRanked = q ? ranked.filter(matches) : ranked
  const hasAny = filteredFeatured.length > 0 || filteredRanked.length > 0

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
        ) : !hasAny ? (
          <EmptyState title={t.noResults} subtitle={t.notFoundHint} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filteredFeatured.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t.featuredStores}</Text>
                  <View style={styles.plusPill}>
                    <Text style={styles.plusPillText}>{locale === 'ar' ? 'بلس' : 'PLUS'}</Text>
                  </View>
                </View>
                <StoreGrid items={filteredFeatured} />
              </View>
            )}
            {filteredRanked.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t.allStores}</Text>
                </View>
                <StoreGrid items={filteredRanked} />
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  )
}

function StoreGrid({ items }: { items: Store[] }) {
  const rows: Store[][] = []
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))
  return (
    <View style={{ gap: spacing.lg }}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map(s => (
            <View key={s.id} style={{ flex: 1 }}>
              <StoreCard store={s} style={{ flex: 1 }} />
            </View>
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
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
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.dk,
  },
  plusPill: {
    backgroundColor: colors.y,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  plusPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.dk,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
})
