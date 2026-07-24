import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import {
  Branch,
  getLocations,
  getStoreBranches,
  getStoreProducts,
  getStoreProfile,
  imgUrl,
  localeName,
  LocationNode,
  Product,
  Store,
} from '@/lib/api'
import { trackStoreView } from '@/lib/analytics'
import { FollowButton } from '@/components/FollowButton'
import { ProductCard } from '@/components/ProductCard'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const COVER_HEIGHT = 240
const LOGO_SIZE = 100

type SocialKey = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin'

const SOCIAL_ICONS: Record<SocialKey, React.ComponentProps<typeof Ionicons>['name']> = {
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  twitter: 'logo-twitter',
  tiktok: 'logo-tiktok',
  youtube: 'logo-youtube',
  linkedin: 'logo-linkedin',
}

const SOCIAL_COLORS: Record<SocialKey, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  tiktok: '#010101',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
}

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, locale, isRtl, setLocale } = useLocale()
  const insets = useSafeAreaInsets()

  // Direction-aware text style — applied to every Text so Arabic reads RTL
  // and English LTR even when the native I18nManager flag lags a hot switch.
  const dir = {
    writingDirection: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    textAlign: 'auto' as const,
  }
  const backIcon = isRtl ? 'chevron-forward-outline' : 'chevron-back-outline'
  const forwardIcon = isRtl ? 'chevron-back-outline' : 'chevron-forward-outline'

  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [locs, setLocs] = useState<LocationNode[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const storeId = Number(id)

  // Mirrors website: match title OR category name, case-insensitive.
  // Must live before any early returns so hook order stays stable across
  // loading → loaded transitions (Rules of Hooks).
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => {
      const title = p.title?.toLowerCase() ?? ''
      const cat = localeName(p.category?.translations ?? [], locale).toLowerCase()
      return title.includes(q) || cat.includes(q)
    })
  }, [products, query, locale])

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const s = await getStoreProfile(storeId)
      setStore(s)
      if (s.type === 'store_plus') {
        getStoreBranches(storeId).then(setBranches).catch(() => {})
        getLocations().then(setLocs).catch(() => {})
      }
    } catch (e) {
      console.error('Failed to load store:', e)
    } finally {
      setLoading(false)
    }
    try {
      const p = await getStoreProducts(storeId, { limit: 20 })
      const items = Array.isArray(p) ? p : ((p as any).items ?? [])
      setProducts(items)
    } catch (e) {
      console.error('Failed to load products:', e)
    }
  }, [id, storeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (Number.isFinite(storeId) && storeId > 0) trackStoreView(storeId)
  }, [storeId])

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.y} size="large" />
      </View>
    )
  }

  if (!store) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={[styles.missing, dir]}>{t.noResults}</Text>
      </View>
    )
  }

  const { storeProfile } = store
  const logo = imgUrl(storeProfile.logo)
  const cover = imgUrl(storeProfile.cover)
  const isStorePlus = store.type === 'store_plus'

  const socialLinks = (Object.keys(SOCIAL_ICONS) as SocialKey[]).filter(
    k => !!(storeProfile as unknown as Record<string, unknown>)[k],
  )
  const hasSocial = socialLinks.length > 0 || !!storeProfile.websiteUrl

  // Store Plus branches: `general` rows are contact-only extra numbers,
  // `branch` rows are physical locations that get translated via /locations.
  const generals = branches.filter(b => b.type === 'general')
  const branchList = branches.filter(b => b.type === 'branch')
  const locName = (lid: number | null) =>
    lid ? localeName(locs.find(l => l.id === lid)?.translations ?? [], locale) : null

  // Mirror the website: `01x` → `+201x` → `wa.me/201x`.
  const rawPhone = store.phone?.replace(/\s+/g, '') ?? null
  const waPhone = rawPhone
    ? rawPhone.startsWith('+')
      ? rawPhone.slice(1)
      : rawPhone.startsWith('0')
        ? '20' + rawPhone.slice(1)
        : rawPhone
    : null
  const waLink = waPhone ? `https://wa.me/${waPhone}` : null

  const contactLabel = locale === 'ar' ? 'معلومات التواصل' : 'Contact Info'
  const searchPlaceholder = locale === 'ar' ? 'ابحث في منتجات المتجر…' : 'Search store products…'
  const noMatchesText = locale === 'ar' ? 'لا توجد منتجات مطابقة لبحثك.' : 'No products match your search.'

  const ACTION_BAR_HEIGHT = 80 + Math.max(insets.bottom, spacing.md)

  return (
    <View style={styles.root}>
      {/* Cover */}
      <View style={styles.coverBg}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.coverImg} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.coverOverlay} />

        {/* Type chip — floats above the card edge so the name area stays clean.
            Reads against the dark cover thanks to the pill's own light bg. */}
        <View style={styles.coverTypeBadge} pointerEvents="none">
          {isStorePlus ? (
            <View style={styles.plusPill}>
              <Ionicons name="star" size={11} color={colors.dk} />
              <Text style={[styles.plusPillText, dir]}>Store Plus</Text>
            </View>
          ) : (
            <View style={styles.typePill}>
              <Text style={[styles.typePillText, dir]}>{t.iAmStore}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Floating header */}
      <SafeAreaView style={styles.header} edges={['top']} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name={backIcon} size={22} color={colors.white} />
          </Pressable>

          <View style={styles.headerSpacer} />

          <Pressable
            style={styles.iconBtn}
            onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            hitSlop={8}
          >
            <Ionicons name="globe-outline" size={20} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push('/dashboard/notifications')}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push('/dashboard/messages')}
            hitSlop={8}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.white} />
          </Pressable>

          <FollowButton storeId={storeId} />
        </View>
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: ACTION_BAR_HEIGHT + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: COVER_HEIGHT - 32 }} />

        <View style={styles.card}>
          <View style={styles.handle} />

          {/* Logo */}
          <View style={styles.logoWrap}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logo} resizeMode="cover" />
            ) : (
              <View style={[styles.logo, styles.logoFallback]}>
                <Text style={[styles.logoInitial, dir]}>
                  {(storeProfile.name?.charAt(0) ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            {isStorePlus && (
              <View style={styles.plusBadge}>
                <Ionicons name="star" size={11} color={colors.dk} />
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={[styles.storeName, dir]}>{storeProfile.name ?? ''}</Text>

          {/* Description */}
          {!!storeProfile.description && (
            <Text style={[styles.description, dir]}>{storeProfile.description}</Text>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, dir]}>{products.length}</Text>
              <Text style={[styles.statLabel, dir]}>{t.storeProducts}</Text>
            </View>
            {isStorePlus && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, dir]}>{branchList.length}</Text>
                  <Text style={[styles.statLabel, dir]}>{t.branches}</Text>
                </View>
              </>
            )}
          </View>

          {/* Contact Info — main phone + store_plus generals + WhatsApp */}
          {(!!store.phone || generals.length > 0 || !!waLink) && (
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Ionicons name="call" size={14} color={colors.y} />
                <Text style={[styles.contactHeaderText, dir]}>{contactLabel}</Text>
              </View>

              {!!store.phone && (
                <Pressable
                  style={styles.contactCard}
                  onPress={() => Linking.openURL(`tel:${store.phone}`)}
                >
                  <View style={styles.contactIconWrap}>
                    <Ionicons name="call-outline" size={18} color={colors.y} />
                  </View>
                  <Text style={[styles.contactText, dir]}>{store.phone}</Text>
                  <Ionicons name={forwardIcon} size={16} color={colors.g400} />
                </Pressable>
              )}

              {generals.map(g => (
                <Pressable
                  key={g.id}
                  style={styles.contactCard}
                  onPress={() => g.phone && Linking.openURL(`tel:${g.phone}`)}
                  disabled={!g.phone}
                >
                  <View style={styles.contactIconWrap}>
                    <Ionicons name="call-outline" size={18} color={colors.y} />
                  </View>
                  <View style={styles.contactTextWrap}>
                    <Text style={[styles.contactLabel, dir]} numberOfLines={1}>{g.name}</Text>
                    {!!g.phone && (
                      <Text style={[styles.contactText, dir]} numberOfLines={1}>{g.phone}</Text>
                    )}
                  </View>
                  {!!g.phone && (
                    <Ionicons name={forwardIcon} size={16} color={colors.g400} />
                  )}
                </Pressable>
              ))}

              {!!waLink && (
                <Pressable
                  style={styles.contactCard}
                  onPress={() => Linking.openURL(waLink)}
                >
                  <View style={styles.contactIconWrap}>
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  </View>
                  <Text style={[styles.contactText, dir]}>{t.whatsapp}</Text>
                  <Ionicons name={forwardIcon} size={16} color={colors.g400} />
                </Pressable>
              )}
            </View>
          )}

          {/* Social links */}
          {hasSocial && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.socialRow}
              style={styles.socialScroll}
            >
              {socialLinks.map(key => {
                const url = (storeProfile as unknown as Record<string, unknown>)[key] as string
                const brandColor = SOCIAL_COLORS[key]
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.socialBtn,
                      { backgroundColor: brandColor + '12', borderColor: brandColor + '35' },
                    ]}
                    onPress={() => Linking.openURL(url)}
                  >
                    <Ionicons name={SOCIAL_ICONS[key]} size={20} color={brandColor} />
                  </Pressable>
                )
              })}
              {storeProfile.websiteUrl && (
                <Pressable
                  style={styles.socialBtn}
                  onPress={() => Linking.openURL(storeProfile.websiteUrl!)}
                >
                  <Ionicons name="globe-outline" size={20} color={colors.dk} />
                </Pressable>
              )}
            </ScrollView>
          )}

          {/* Section divider */}
          <View style={styles.divider} />

          {/* Products */}
          <View style={styles.productsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionAccent} />
              <Text style={[styles.sectionTitle, dir]}>{t.storeProducts}</Text>
              {filteredProducts.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={[styles.countBadgeText, dir]}>{filteredProducts.length}</Text>
                </View>
              )}
            </View>

            {/* Store Plus mini-store search — mirrors website /s/[id] filter.
                Regular stores don't get this control; keeps the plain store
                page compact. */}
            {isStorePlus && products.length > 0 && (
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.g500} />
                <TextInput
                  style={[styles.searchInput, dir]}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.g400}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <Pressable
                    style={styles.searchClearBtn}
                    onPress={() => setQuery('')}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.g500} />
                  </Pressable>
                )}
              </View>
            )}

            {filteredProducts.length > 0 ? (
              <FlatList
                data={filteredProducts}
                keyExtractor={p => String(p.id)}
                numColumns={2}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <ProductCard product={item} style={styles.productCard} />
                )}
                contentContainerStyle={styles.productGrid}
                columnWrapperStyle={styles.productRow}
              />
            ) : (
              <View style={styles.emptyProducts}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name={query ? 'search-outline' : 'cube-outline'}
                    size={30}
                    color={colors.y}
                  />
                </View>
                <Text style={[styles.emptyText, dir]}>
                  {query ? noMatchesText : t.noResults}
                </Text>
              </View>
            )}
          </View>

          {/* Branches — store_plus only (physical `branch` rows) */}
          {isStorePlus && branchList.length > 0 && (
            <View style={styles.branchesSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionAccent} />
                <Text style={[styles.sectionTitle, dir]}>{t.branches}</Text>
                <View style={styles.countBadge}>
                  <Text style={[styles.countBadgeText, dir]}>{branchList.length}</Text>
                </View>
              </View>
              <View style={styles.branchList}>
                {branchList.map(branch => {
                  const location = locName(branch.locationId)
                  return (
                    <View key={branch.id} style={styles.branchCard}>
                      <View style={styles.branchIconWrap}>
                        <Ionicons name="location-outline" size={18} color={colors.y} />
                      </View>
                      <View style={styles.branchInfo}>
                        <Text style={[styles.branchName, dir]} numberOfLines={1}>{branch.name}</Text>
                        {!!location && (
                          <View style={styles.branchMetaRow}>
                            <Ionicons name="pin-outline" size={11} color={colors.g500} />
                            <Text style={[styles.branchPhone, dir]} numberOfLines={1}>{location}</Text>
                          </View>
                        )}
                        {!!branch.phone && (
                          <View style={styles.branchMetaRow}>
                            <Ionicons name="call-outline" size={11} color={colors.g500} />
                            <Text style={[styles.branchPhone, dir]} numberOfLines={1}>{branch.phone}</Text>
                          </View>
                        )}
                      </View>
                      {!!branch.phone && (
                        <Pressable
                          style={styles.branchCallBtn}
                          onPress={() => Linking.openURL(`tel:${branch.phone}`)}
                        >
                          <Ionicons name="call-outline" size={15} color={colors.y} />
                        </Pressable>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action bar */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {isStorePlus && storeProfile.websiteUrl ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => Linking.openURL(storeProfile.websiteUrl!)}
          >
            <Ionicons name="globe-outline" size={20} color={colors.dk} />
            <Text style={[styles.primaryBtnText, dir]}>{t.storeWebsite}</Text>
          </Pressable>
        ) : store.whatsapp ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => Linking.openURL(`https://wa.me/${store.whatsapp?.replace(/\D/g, '')}`)}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.dk} />
            <Text style={[styles.primaryBtnText, dir]}>{t.contactStore}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/dashboard/messages')}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.g700} />
          <Text style={[styles.secondaryBtnText, dir]}>{t.messages}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dk },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dk,
  },
  missing: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g400,
  },

  // ── Cover ────────────────────────────────────────────────────────────────────
  coverBg: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    height: COVER_HEIGHT,
    overflow: 'hidden',
    backgroundColor: colors.dk,
  },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, backgroundColor: colors.dk2 },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,37,64,0.42)',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.y,
    opacity: 0.07,
    top: -110,
    end: -70,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.white,
    opacity: 0.04,
    bottom: -50,
    start: -55,
  },

  // ── Floating header ──────────────────────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerSpacer: { flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  // ── Scroll + card ────────────────────────────────────────────────────────────
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopStartRadius: 28,
    borderTopEndRadius: 28,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    minHeight: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.g300,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },

  // ── Logo ─────────────────────────────────────────────────────────────────────
  logoWrap: {
    alignSelf: 'center',
    marginTop: -(LOGO_SIZE / 2 + spacing.sm),
    marginBottom: spacing.md,
    position: 'relative',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  logoFallback: {
    backgroundColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: fonts.black,
    fontSize: 36,
    color: colors.y,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 3,
    end: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
    shadowColor: colors.y,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── Name + badge ─────────────────────────────────────────────────────────────
  storeName: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.g900,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  // Anchored to the bottom-start of the cover so the chip sits just above
  // the card's rounded edge, out of the way of the header buttons and logo.
  coverTypeBadge: {
    position: 'absolute',
    bottom: 44,
    start: spacing.lg,
    zIndex: 5,
  },
  typePill: {
    backgroundColor: colors.g100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  typePillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
  },
  plusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.yl,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: colors.y,
  },
  plusPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.dk,
  },

  // ── Description ──────────────────────────────────────────────────────────────
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },

  // ── Stats ────────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.g100,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: colors.y,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.g200,
  },

  // ── Contact card ─────────────────────────────────────────────────────────────
  contactSection: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    marginBottom: 2,
  },
  contactHeaderText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.g600,
    letterSpacing: 0.3,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.g100,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTextWrap: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  contactText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g800,
  },

  // ── Social ───────────────────────────────────────────────────────────────────
  socialScroll: { marginBottom: spacing.lg },
  socialRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.g100,
    borderWidth: 1,
    borderColor: colors.g200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  divider: {
    height: 8,
    backgroundColor: colors.g100,
    marginBottom: spacing.md,
  },

  // ── Section header ───────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.y,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.g900,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.yl,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.y,
  },
  countBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.dk,
  },

  // ── Products ─────────────────────────────────────────────────────────────────
  productsSection: {},
  productGrid: { paddingHorizontal: spacing.md },
  productRow: { gap: spacing.sm, marginBottom: spacing.sm },
  productCard: { flex: 1, width: undefined },

  // Store Plus product search — quiet g100 chip so it disappears when idle
  // and only asserts itself once the user starts typing.
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.g100,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
    padding: 0,
  },
  searchClearBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g500,
  },

  // ── Branches ─────────────────────────────────────────────────────────────────
  branchesSection: { marginTop: spacing.md },
  branchList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.g100,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  branchIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchInfo: { flex: 1, gap: 3 },
  branchName: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g900,
  },
  branchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  branchPhone: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
  },
  branchCallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.y,
  },

  // ── Action bar ───────────────────────────────────────────────────────────────
  actionBar: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.g200,
    ...shadow.md,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.y,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.g100,
    borderRadius: radius.lg,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.g200,
  },
  secondaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.g700,
  },
})
