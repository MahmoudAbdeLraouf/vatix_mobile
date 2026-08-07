import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import {
  Branch,
  ConversationListItem,
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
import { authPost } from '@/lib/auth'
import { trackStoreView } from '@/lib/analytics'
import { FollowButton } from '@/components/FollowButton'
import { ProductCard } from '@/components/ProductCard'
import { BottomTabBar } from '@/components/BottomTabBar'
import { colors, fonts, radius, spacing } from '@/constants/theme'

const COVER_HEIGHT = 180
const LOGO_SIZE = 76
// Threshold past which the sticky action row appears (approx hero height).
const STICKY_THRESHOLD = 260

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

type TabKey = 'products' | 'about' | 'branches'

type PhoneEntry = {
  key: string
  label: string
  phone: string
}

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, locale, isRtl, setLocale } = useLocale()
  const { requireLogin } = useLoginGate()
  const insets = useSafeAreaInsets()

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
  const [startingChat, setStartingChat] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descTruncatable, setDescTruncatable] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('products')
  const [showStickyActions, setShowStickyActions] = useState(false)
  const [phoneSheetOpen, setPhoneSheetOpen] = useState(false)

  const storeId = Number(id)

  const startChat = useCallback(async () => {
    if (!requireLogin()) return
    if (startingChat || !storeId) return
    setStartingChat(true)
    try {
      const conv = await authPost<ConversationListItem>('/conversations', {
        recipientId: storeId,
      })
      router.push(`/dashboard/messages/${conv.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      Alert.alert(t.startChat, msg)
    } finally {
      setStartingChat(false)
    }
  }, [requireLogin, startingChat, storeId, t])

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

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const next = y > STICKY_THRESHOLD
    setShowStickyActions(prev => (prev === next ? prev : next))
  }, [])

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
  const storeIdent = storeProfile.slug ?? store.id
  const storePlusUrl = isStorePlus
    ? storeProfile.websiteUrl || `https://vatix.store/s/${storeIdent}`
    : null

  const socialLinks = (Object.keys(SOCIAL_ICONS) as SocialKey[]).filter(
    k => !!(storeProfile as unknown as Record<string, unknown>)[k],
  )
  const showWebsiteInSocial = !!storeProfile.websiteUrl && !isStorePlus
  const hasSocial = socialLinks.length > 0 || showWebsiteInSocial

  const generals = branches.filter(b => b.type === 'general')
  const branchList = branches.filter(b => b.type === 'branch')
  const locName = (lid: number | null) =>
    lid ? localeName(locs.find(l => l.id === lid)?.translations ?? [], locale) : null

  // Consolidated phone list drives both the "Call" bottom sheet and the About
  // tab list. Main phone leads, then labeled general lines, then branch lines.
  const phoneEntries: PhoneEntry[] = []
  if (store.phone) {
    phoneEntries.push({ key: 'main', label: t.mainPhone, phone: store.phone })
  }
  generals.forEach(g => {
    if (g.phone) phoneEntries.push({ key: `g-${g.id}`, label: g.name ?? t.phone, phone: g.phone })
  })
  branchList.forEach(b => {
    if (b.phone) phoneEntries.push({ key: `b-${b.id}`, label: b.name ?? t.branches, phone: b.phone })
  })

  const rawPhone = store.phone?.replace(/\s+/g, '') ?? null
  const waPhone = rawPhone
    ? rawPhone.startsWith('+')
      ? rawPhone.slice(1)
      : rawPhone.startsWith('0')
        ? '20' + rawPhone.slice(1)
        : rawPhone
    : null
  const shareStoreUrl = storePlusUrl ?? `https://vatix.store/stores/${storeIdent}`
  const shareGreeting = locale === 'ar' ? 'تفضلوا بزيارة متجري على VATIX' : 'Visit my store on VATIX'
  const waMessage = `${storeProfile.name ?? ''}\n${shareGreeting}\n${shareStoreUrl}`
  const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : null

  const searchPlaceholder = locale === 'ar' ? 'ابحث في منتجات المتجر…' : 'Search store products…'
  const noMatchesText = locale === 'ar' ? 'لا توجد منتجات مطابقة لبحثك.' : 'No products match your search.'
  const dotSeparator = ' · '

  const TAB_BAR_HEIGHT = 62 + insets.bottom

  // Single-tap Call — direct dial if one number, sheet if multiple.
  const onCallPress = () => {
    if (phoneEntries.length === 0) return
    if (phoneEntries.length === 1) {
      Linking.openURL(`tel:${phoneEntries[0].phone}`)
      return
    }
    setPhoneSheetOpen(true)
  }

  const onSharePress = async () => {
    try {
      await Share.share({
        message: waMessage,
        url: shareStoreUrl,
        title: storeProfile.name ?? '',
      })
    } catch {
      // User dismissed share sheet — nothing to do.
    }
  }

  const availableTabs: TabKey[] = ['products', 'about', ...(isStorePlus && branchList.length > 0 ? (['branches'] as TabKey[]) : [])]
  const tabLabel: Record<TabKey, string> = {
    products: t.storeProducts,
    about: t.about,
    branches: t.branches,
  }

  const canCall = phoneEntries.length > 0
  const canWhats = !!waLink
  const canWebsite = !!storePlusUrl

  const renderActionPill = (
    key: string,
    icon: React.ComponentProps<typeof Ionicons>['name'],
    label: string,
    onPress: () => void,
    opts: { primary?: boolean; iconColor?: string; disabled?: boolean; loading?: boolean } = {},
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={opts.disabled}
      style={({ pressed }) => [
        styles.actionPill,
        opts.primary && styles.actionPillPrimary,
        pressed && styles.actionPillPressed,
        opts.disabled && styles.actionPillDisabled,
      ]}
    >
      <View style={[styles.actionIconWrap, opts.primary && styles.actionIconWrapPrimary]}>
        {opts.loading ? (
          <ActivityIndicator size="small" color={opts.primary ? colors.dk : colors.y} />
        ) : (
          <Ionicons
            name={icon}
            size={20}
            color={opts.primary ? colors.dk : (opts.iconColor ?? colors.dk)}
          />
        )}
      </View>
      <Text
        style={[styles.actionLabel, opts.primary && styles.actionLabelPrimary, dir]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )

  const actionRow = (
    <View style={styles.actionRow}>
      {renderActionPill('chat', 'chatbubbles', t.startChat, startChat, {
        primary: true,
        loading: startingChat,
        disabled: startingChat,
      })}
      {canCall &&
        renderActionPill('call', 'call', t.callSeller, onCallPress, {
          iconColor: colors.y,
        })}
      {canWhats &&
        renderActionPill('wa', 'logo-whatsapp', t.whatsappSeller, () => Linking.openURL(waLink!), {
          iconColor: '#25D366',
        })}
      {canWebsite &&
        renderActionPill('web', 'globe-outline', t.storeWebsite, () => Linking.openURL(storePlusUrl!), {
          iconColor: colors.dk,
        })}
    </View>
  )

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
      </View>

      {/* Floating header */}
      <SafeAreaView style={styles.header} edges={['top']} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name={backIcon} size={22} color={colors.white} />
          </Pressable>

          <View style={styles.headerSpacer} />

          <FollowButton storeId={storeId} style={styles.headerFollowBtn} />

          <Pressable style={styles.iconBtn} onPress={onSharePress} hitSlop={8}>
            <Ionicons name="share-outline" size={20} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            hitSlop={8}
          >
            <Ionicons name="globe-outline" size={20} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              if (!requireLogin()) return
              router.push('/dashboard/notifications')
            }}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={{ height: COVER_HEIGHT - 40 }} />

        <View style={styles.card}>
          <View style={styles.handle} />

          {/* Hero: logo + name column (follow lives up in the cover header) */}
          <View style={styles.heroRow}>
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
                  <Ionicons name="star" size={10} color={colors.dk} />
                </View>
              )}
            </View>

            <View style={styles.heroTextCol}>
              <View style={styles.nameRow}>
                <Text style={[styles.storeName, dir]} numberOfLines={2}>
                  {storeProfile.name ?? ''}
                </Text>
              </View>
              <View style={styles.metaRow}>
                {isStorePlus && (
                  <View style={styles.verifiedPill}>
                    <Ionicons name="checkmark-circle" size={11} color={colors.y} />
                    <Text style={[styles.verifiedText, dir]}>{t.storeTypeStorePlus}</Text>
                  </View>
                )}
                <Text style={[styles.metaText, dir]} numberOfLines={1}>
                  {[
                    `${products.length} ${t.storeProducts}`,
                    isStorePlus && branchList.length > 0 ? `${branchList.length} ${t.branches}` : null,
                  ]
                    .filter(Boolean)
                    .join(dotSeparator)}
                </Text>
              </View>
            </View>
          </View>

          {/* Description with expand/collapse */}
          {!!storeProfile.description && (
            <View style={styles.descWrap}>
              <Text
                style={[styles.description, dir]}
                numberOfLines={descExpanded ? undefined : 2}
                onTextLayout={e => {
                  if (!descTruncatable && e.nativeEvent.lines.length > 2) setDescTruncatable(true)
                }}
              >
                {storeProfile.description}
              </Text>
              {descTruncatable && (
                <Pressable
                  onPress={() => setDescExpanded(v => !v)}
                  hitSlop={6}
                  style={styles.descToggleBtn}
                >
                  <Text style={[styles.descToggleText, dir]}>
                    {descExpanded ? t.viewLess : t.viewMore}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Primary action row */}
          {actionRow}

          {/* Segmented tabs */}
          <View style={styles.tabsRow}>
            {availableTabs.map(tab => {
              const active = tab === activeTab
              return (
                <Pressable
                  key={tab}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive, dir]}>
                    {tabLabel[tab]}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* Tab content */}
          {activeTab === 'products' && (
            <View style={styles.tabPanel}>
              {products.length > 0 && (
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
                    <Pressable style={styles.searchClearBtn} onPress={() => setQuery('')} hitSlop={8}>
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
                <View style={styles.emptyState}>
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
          )}

          {activeTab === 'about' && (
            <View style={styles.tabPanel}>
              {!!storeProfile.description && (
                <View style={styles.aboutBlock}>
                  <Text style={[styles.aboutBlockTitle, dir]}>{t.about}</Text>
                  <Text style={[styles.aboutBody, dir]}>{storeProfile.description}</Text>
                </View>
              )}

              {phoneEntries.length > 0 && (
                <View style={styles.aboutBlock}>
                  <Text style={[styles.aboutBlockTitle, dir]}>{t.phone}</Text>
                  <View style={styles.phoneList}>
                    {phoneEntries.map(entry => (
                      <Pressable
                        key={entry.key}
                        style={styles.contactCard}
                        onPress={() => Linking.openURL(`tel:${entry.phone}`)}
                      >
                        <View style={styles.contactIconWrap}>
                          <Ionicons name="call-outline" size={18} color={colors.y} />
                        </View>
                        <View style={styles.contactTextWrap}>
                          <Text style={[styles.contactLabel, dir]} numberOfLines={1}>
                            {entry.label}
                          </Text>
                          <Text style={[styles.contactText, dir]} numberOfLines={1}>
                            {entry.phone}
                          </Text>
                        </View>
                        <Ionicons name={forwardIcon} size={16} color={colors.g400} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {hasSocial && (
                <View style={styles.aboutBlock}>
                  <Text style={[styles.aboutBlockTitle, dir]}>{t.socialMedia}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.socialRow}
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
                    {showWebsiteInSocial && (
                      <Pressable
                        style={styles.socialBtn}
                        onPress={() => Linking.openURL(storeProfile.websiteUrl!)}
                      >
                        <Ionicons name="globe-outline" size={20} color={colors.dk} />
                      </Pressable>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {activeTab === 'branches' && (
            <View style={styles.tabPanel}>
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

      {/* Sticky action row (appears once hero scrolls off) */}
      {showStickyActions && (
        <View style={[styles.stickyActionsWrap, { bottom: TAB_BAR_HEIGHT }]} pointerEvents="box-none">
          <View style={styles.stickyActionsInner}>{actionRow}</View>
        </View>
      )}

      {/* Sticky bottom tab bar */}
      <View style={styles.tabBarAnchor}>
        <BottomTabBar />
      </View>

      {/* Phone chooser bottom sheet */}
      <Modal
        visible={phoneSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoneSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPhoneSheetOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, dir]}>{t.chooseNumber}</Text>
            {phoneEntries.map(entry => (
              <Pressable
                key={entry.key}
                style={styles.sheetItem}
                onPress={() => {
                  setPhoneSheetOpen(false)
                  Linking.openURL(`tel:${entry.phone}`)
                }}
              >
                <View style={styles.sheetIconWrap}>
                  <Ionicons name="call" size={18} color={colors.y} />
                </View>
                <View style={styles.sheetTextWrap}>
                  <Text style={[styles.sheetItemLabel, dir]} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <Text style={[styles.sheetItemPhone, dir]} numberOfLines={1}>
                    {entry.phone}
                  </Text>
                </View>
                <Ionicons name={forwardIcon} size={16} color={colors.g400} />
              </Pressable>
            ))}
            <Pressable style={styles.sheetCancel} onPress={() => setPhoneSheetOpen(false)}>
              <Text style={[styles.sheetCancelText, dir]}>{t.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.y,
    opacity: 0.07,
    top: -100,
    end: -70,
  },
  circle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.white,
    opacity: 0.04,
    bottom: -60,
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
  // Follow pill lives in the cover header so the store name below gets the full row.
  // Match iconBtn height (40) and pull the label in tight to sit alongside the icons.
  headerFollowBtn: {
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
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

  // ── Hero row ─────────────────────────────────────────────────────────────────
  // Inline layout replaces the old centered-avatar block. Logo + name column
  // pack into ~120px vertical so the action row and products sit above the fold.
  // The follow pill lives up in the cover header — see headerFollowBtn.
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -(LOGO_SIZE / 2),
    marginBottom: spacing.md,
  },
  logoWrap: { position: 'relative' },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.g100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  logoFallback: {
    backgroundColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: fonts.black,
    fontSize: 28,
    color: colors.y,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    end: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  heroTextCol: {
    flex: 1,
    gap: 4,
    paddingTop: LOGO_SIZE / 2 - 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeName: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 18,
    lineHeight: 22,
    color: colors.g900,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.yl,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.y,
  },
  verifiedText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.dk,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    flexShrink: 1,
  },

  // ── Description ──────────────────────────────────────────────────────────────
  descWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 4,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    lineHeight: 20,
  },
  descToggleBtn: { alignSelf: 'flex-start' },
  descToggleText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.dk,
  },

  // ── Action pills ─────────────────────────────────────────────────────────────
  // Compact vertical pills (icon + label). Equal flex keeps the row balanced
  // whether the store has 2, 3, or 4 actions available.
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  actionPill: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.g100,
    borderWidth: 1,
    borderColor: colors.g200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  actionPillPrimary: {
    backgroundColor: colors.y,
    borderColor: colors.y,
    shadowColor: colors.y,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionPillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  actionPillDisabled: {
    opacity: 0.6,
  },
  actionIconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrapPrimary: {},
  actionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.g700,
    textAlign: 'center',
  },
  actionLabelPrimary: {
    color: colors.dk,
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.g100,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g500,
  },
  tabLabelActive: {
    fontFamily: fonts.bold,
    color: colors.dk,
  },
  tabPanel: {},

  // ── About tab ────────────────────────────────────────────────────────────────
  aboutBlock: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  aboutBlockTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.g600,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  aboutBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.g700,
  },
  phoneList: { gap: spacing.sm },

  // ── Contact card (used in About tab phones) ─────────────────────────────────
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g800,
  },

  // ── Social ───────────────────────────────────────────────────────────────────
  socialRow: {
    flexDirection: 'row',
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

  // ── Products ─────────────────────────────────────────────────────────────────
  productGrid: { paddingHorizontal: spacing.md },
  productRow: { gap: spacing.sm, marginBottom: spacing.sm },
  productCard: { flex: 1, width: undefined },

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

  // ── Empty ────────────────────────────────────────────────────────────────────
  emptyState: {
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

  // ── Sticky action row ────────────────────────────────────────────────────────
  stickyActionsWrap: {
    position: 'absolute',
    start: 0,
    end: 0,
    zIndex: 5,
  },
  stickyActionsInner: {
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.g200,
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },

  // ── Tab bar anchor ───────────────────────────────────────────────────────────
  tabBarAnchor: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
  },

  // ── Bottom sheet (phone chooser) ─────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopStartRadius: 24,
    borderTopEndRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.g300,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.g900,
    marginBottom: spacing.md,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.g200,
  },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTextWrap: {
    flex: 1,
    gap: 2,
  },
  sheetItemLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
  },
  sheetItemPhone: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.g900,
  },
  sheetCancel: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: colors.g100,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.g700,
  },
})
