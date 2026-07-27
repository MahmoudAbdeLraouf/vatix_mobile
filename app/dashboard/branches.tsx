import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { useLocale } from '@/contexts/locale'
import { authFetch, authPost, authPatch, authDelete } from '@/lib/auth'
import {
  getLocations,
  localeName,
  type Branch,
  type LocationNode,
  type UserProfile,
} from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Msg = { ok: boolean; text: string } | null
type BranchType = 'branch' | 'general'

interface FormState {
  name: string
  phone: string
  type: BranchType
  locationId: string
}

const EMPTY_FORM: FormState = { name: '', phone: '', type: 'branch', locationId: '' }

function locationSubLabel(type: string, ar: boolean): string {
  const t = type?.toLowerCase()
  if (t === 'governorate') return ar ? 'محافظة' : 'Governorate'
  if (t === 'district') return ar ? 'حي' : 'District'
  if (t === 'area') return ar ? 'منطقة' : 'Area'
  return ar ? 'دولة' : 'Country'
}

export default function BranchesScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [msg, setMsg] = useState<Msg>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const isStorePlus = (profile?.type ?? '').toString().toUpperCase() === 'STORE_PLUS'

  useEffect(() => {
    (async () => {
      try {
        const [prof, list, locs] = await Promise.all([
          authFetch<UserProfile>('/user/profile'),
          authFetch<Branch[]>('/user/branches'),
          getLocations().catch(() => [] as LocationNode[]),
        ])
        if (prof) setProfile(prof)
        if (list) setBranches(list)
        setLocations((locs ?? []).filter(l => l.isActive))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function reloadBranches() {
    const list = await authFetch<Branch[]>('/user/branches')
    if (list) setBranches(list)
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setMsg(null)
    setModalOpen(true)
  }

  function openEdit(b: Branch) {
    setEditingId(b.id)
    setForm({
      name: b.name,
      phone: b.phone ?? '',
      type: b.type,
      locationId: b.locationId ? String(b.locationId) : '',
    })
    setMsg(null)
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setMsg({ ok: false, text: ar ? 'الاسم مطلوب' : 'Name is required' })
      return
    }
    if (form.type === 'branch' && !form.locationId) {
      setMsg({ ok: false, text: ar ? 'اختر الموقع' : 'Please choose a location' })
      return
    }

    setSaving(true)
    setMsg(null)
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      type: form.type,
      locationId:
        form.type === 'branch' && form.locationId ? Number(form.locationId) : null,
    }
    try {
      if (editingId != null) {
        await authPatch<Branch>(`/user/branches/${editingId}`, body)
      } else {
        await authPost<Branch>('/user/branches', body)
      }
      await reloadBranches()
      setModalOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      setMsg({
        ok: true,
        text: ar ? 'تم الحفظ بنجاح ✓' : 'Saved successfully ✓',
      })
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : ar ? 'حدث خطأ أثناء الحفظ' : 'Save failed',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(b: Branch) {
    Alert.alert(
      ar ? 'تأكيد الحذف' : 'Confirm delete',
      ar ? 'حذف هذا الفرع/الرقم؟' : 'Delete this branch/number?',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(b.id)
            const ok = await authDelete(`/user/branches/${b.id}`)
            setDeletingId(null)
            if (ok) {
              await reloadBranches()
              setMsg({ ok: true, text: ar ? 'تم الحذف' : 'Deleted' })
            } else {
              setMsg({ ok: false, text: ar ? 'تعذّر الحذف' : 'Delete failed' })
            }
          },
        },
      ],
    )
  }

  const locationOptions: SelectOption[] = useMemo(
    () =>
      locations.map(l => ({
        value: String(l.id),
        label: localeName(l.translations, locale) || `#${l.id}`,
        sub: locationSubLabel(l.type, ar),
      })),
    [locations, locale, ar],
  )

  const bBranches = branches.filter(b => b.type === 'branch')
  const bGeneral = branches.filter(b => b.type === 'general')

  const dir = ar ? 'right' : 'left'

  return (
    <DashboardLayout title={ar ? 'الفروع' : 'Branches'} scroll={false}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.y} size="large" />
            </View>
          ) : !profile?.storeProfile || !isStorePlus ? (
            <View style={styles.card}>
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🏢</Text>
                <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                  {ar
                    ? 'إدارة الفروع متاحة فقط لأصحاب متاجر Store Plus.'
                    : 'Branch management is available only for Store Plus owners.'}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.card, dirContainer]}>
                <View style={[styles.headerRow, dirContainer]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]}>
                      {ar ? 'فروع المتجر 🏢' : 'Store Branches 🏢'}
                    </Text>
                    <Text style={[styles.hint, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]}>
                      {ar
                        ? 'أضف فروع متجرك مع أرقام التواصل الخاصة بكل فرع، أو أرقاماً عامة تنطبق على المتجر بأكمله. هذه الأرقام مختلفة عن رقم الجوال المستخدم للتسجيل.'
                        : 'Add your store branches with per-branch contact numbers, or general numbers that apply to the whole store. These are separate from your login phone number.'}
                    </Text>
                  </View>
                </View>

                <Button
                  label={ar ? '＋ إضافة فرع/رقم' : '＋ Add branch/number'}
                  onPress={openCreate}
                  variant="y"
                  size="md"
                  fullWidth={false}
                  style={{ alignSelf: ar ? 'flex-end' : 'flex-start', marginTop: spacing.sm }}
                />

                {msg && (
                  <View
                    style={[
                      styles.msgBox,
                      dirContainer,
                      {
                        backgroundColor: msg.ok ? colors.gl : colors.rl,
                        borderColor: msg.ok ? colors.green : colors.red,
                      },
                    ]}
                  >
                    <Ionicons
                      name={msg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                      size={16}
                      color={msg.ok ? colors.green : colors.red}
                    />
                    <Text
                      style={[
                        styles.msgText,
                        { color: msg.ok ? colors.green : colors.red, textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' },
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>
                )}
              </View>

              {branches.length === 0 ? (
                <View style={styles.card}>
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>🏢</Text>
                    <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                      {ar
                        ? 'لا توجد فروع أو أرقام تواصل بعد.'
                        : 'No branches or contact numbers yet.'}
                    </Text>
                    <View style={{ height: spacing.sm }} />
                    <Button
                      label={ar ? 'أضف أول فرع' : 'Add first branch'}
                      onPress={openCreate}
                      variant="y"
                      size="md"
                      fullWidth={false}
                    />
                  </View>
                </View>
              ) : (
                <>
                  {bBranches.length > 0 && (
                    <View style={styles.section}>
                      <View style={[styles.pill, { backgroundColor: colors.bl }]}>
                        <Text style={[styles.pillText, { color: colors.blue }]}>
                          📍 {ar ? `فروع بمواقع محددة (${bBranches.length})` : `Branches with locations (${bBranches.length})`}
                        </Text>
                      </View>
                      {bBranches.map(b => (
                        <BranchCard
                          key={b.id}
                          branch={b}
                          ar={ar}
                          locationName={
                            b.locationId
                              ? localeName(
                                  locations.find(l => l.id === b.locationId)?.translations ?? [],
                                  locale,
                                )
                              : ''
                          }
                          onEdit={() => openEdit(b)}
                          onDelete={() => handleDelete(b)}
                          deleting={deletingId === b.id}
                        />
                      ))}
                    </View>
                  )}

                  {bGeneral.length > 0 && (
                    <View style={styles.section}>
                      <View style={[styles.pill, { backgroundColor: colors.gl }]}>
                        <Text style={[styles.pillText, { color: colors.green }]}>
                          📞 {ar ? `أرقام عامة (${bGeneral.length})` : `General numbers (${bGeneral.length})`}
                        </Text>
                      </View>
                      {bGeneral.map(b => (
                        <BranchCard
                          key={b.id}
                          branch={b}
                          ar={ar}
                          locationName=""
                          onEdit={() => openEdit(b)}
                          onDelete={() => handleDelete(b)}
                          deleting={deletingId === b.id}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior="padding"
          enabled={Platform.OS === 'ios'}
        >
        <Pressable style={{ flex: 1 }} onPress={closeModal}>
          <Pressable
            style={[
              styles.sheet,
              dirContainer,
              {
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
            ]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.sheetHeader, dirContainer]}>
              <Text style={styles.sheetTitle}>
                {editingId != null
                  ? ar
                    ? 'تعديل فرع/رقم'
                    : 'Edit branch/number'
                  : ar
                    ? 'إضافة فرع/رقم'
                    : 'Add branch/number'}
              </Text>
              <Pressable onPress={closeModal} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.white} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]}>
                {ar ? 'النوع' : 'Type'}
              </Text>
              <View style={[styles.typeGrid, dirContainer]}>
                {(
                  [
                    {
                      v: 'branch' as BranchType,
                      icon: '📍',
                      label: ar ? 'فرع بموقع محدد' : 'Branch with location',
                      sub: ar ? 'يرتبط بمدينة / منطقة' : 'Linked to a city / area',
                    },
                    {
                      v: 'general' as BranchType,
                      icon: '📞',
                      label: ar ? 'رقم عام للمتجر' : 'General store number',
                      sub: ar ? 'ينطبق على كل الفروع' : 'Applies to all branches',
                    },
                  ]
                ).map(opt => {
                  const active = form.type === opt.v
                  return (
                    <Pressable
                      key={opt.v}
                      onPress={() => setForm(f => ({ ...f, type: opt.v }))}
                      style={[
                        styles.typeCard,
                        active && {
                          borderColor: colors.y,
                          backgroundColor: colors.yl,
                        },
                      ]}
                    >
                      <Text style={styles.typeIcon}>{opt.icon}</Text>
                      <Text style={[styles.typeLabel, { textAlign: 'center' }]} numberOfLines={2}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.typeSub, { textAlign: 'center' }]} numberOfLines={2}>
                        {opt.sub}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Input
                label={
                  form.type === 'branch'
                    ? ar
                      ? 'اسم الفرع *'
                      : 'Branch name *'
                    : ar
                      ? 'وصف الرقم *'
                      : 'Number description *'
                }
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                placeholder={
                  form.type === 'branch'
                    ? ar
                      ? 'مثال: فرع القاهرة، فرع الإسكندرية'
                      : 'e.g. Cairo branch, Alexandria branch'
                    : ar
                      ? 'مثال: خط الدعم، خط المبيعات'
                      : 'e.g. Support line, Sales line'
                }
              />

              {form.type === 'branch' && (
                <SearchableSelect
                  label={ar ? 'الموقع *' : 'Location *'}
                  options={locationOptions}
                  value={form.locationId}
                  onChange={v => setForm(f => ({ ...f, locationId: v }))}
                  placeholder={ar ? 'اختر الموقع' : 'Choose location'}
                />
              )}

              <Input
                label={ar ? 'رقم التواصل' : 'Contact phone'}
                value={form.phone}
                onChangeText={v => setForm(f => ({ ...f, phone: v }))}
                placeholder="01012345678"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                // Phone numbers render LTR regardless of UI locale.
                style={{ textAlign: 'left', writingDirection: 'ltr' }}
              />
              <Text style={[styles.hintSmall, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]}>
                {ar
                  ? 'رقم خاص بهذا الفرع — مختلف عن رقم تسجيل الدخول'
                  : 'Number for this branch — separate from login phone'}
              </Text>

              {msg && (
                <View
                  style={[
                    styles.msgBox,
                    dirContainer,
                    {
                      backgroundColor: msg.ok ? colors.gl : colors.rl,
                      borderColor: msg.ok ? colors.green : colors.red,
                      marginTop: spacing.md,
                    },
                  ]}
                >
                  <Ionicons
                    name={msg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                    size={16}
                    color={msg.ok ? colors.green : colors.red}
                  />
                  <Text
                    style={[
                      styles.msgText,
                      { color: msg.ok ? colors.green : colors.red, textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' },
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              )}

              <View style={[styles.sheetActions, dirContainer]}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={ar ? 'إلغاء' : 'Cancel'}
                    variant="outline"
                    size="md"
                    onPress={closeModal}
                    disabled={saving}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Button
                    label={
                      saving
                        ? ar
                          ? 'جاري الحفظ...'
                          : 'Saving...'
                        : editingId != null
                          ? ar
                            ? 'حفظ التعديلات'
                            : 'Save changes'
                          : ar
                            ? 'إضافة'
                            : 'Add'
                    }
                    variant="y"
                    size="md"
                    onPress={handleSave}
                    loading={saving}
                  />
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </DashboardLayout>
  )
}

function BranchCard({
  branch,
  ar,
  locationName,
  onEdit,
  onDelete,
  deleting,
}: {
  branch: Branch
  ar: boolean
  locationName: string
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isBranch = branch.type === 'branch'
  const iconBg = isBranch ? colors.bl : colors.gl
  const iconColor = isBranch ? colors.blue : colors.green
  const dir = ar ? 'right' : 'left'
  const dirContainer = ar ? { direction: 'rtl' as const } : null

  return (
    <View style={[styles.branchCard, dirContainer]}>
      <View style={[styles.branchTop, dirContainer]}>
        <View style={[styles.branchIcon, { backgroundColor: iconBg }]}>
          <Text style={{ fontSize: 18, color: iconColor }}>{isBranch ? '📍' : '📞'}</Text>
        </View>
        <View style={{ flex: 1, marginStart: spacing.sm }}>
          <Text style={[styles.branchName, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]} numberOfLines={2}>
            {branch.name}
          </Text>
          {isBranch && locationName ? (
            <Text style={[styles.branchLoc, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]} numberOfLines={1}>
              📍 {locationName}
            </Text>
          ) : null}
          {branch.phone ? (
            <Text style={styles.branchPhone} numberOfLines={1}>
              {branch.phone}
            </Text>
          ) : (
            <Text style={[styles.branchPhoneEmpty, { textAlign: dir, writingDirection: ar ? 'rtl' : 'ltr' }]} numberOfLines={1}>
              {ar ? 'لا يوجد رقم تواصل' : 'No contact number'}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.branchActions, dirContainer]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'تعديل' : 'Edit'}
            variant="outline"
            size="sm"
            onPress={onEdit}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={deleting ? (ar ? '...' : '...') : ar ? 'حذف' : 'Delete'}
            variant="red"
            size="sm"
            onPress={onDelete}
            loading={deleting}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    ...shadow.ss,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    lineHeight: 20,
  },
  hintSmall: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  section: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  branchCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.ss,
  },
  branchTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  branchIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.dk,
  },
  branchLoc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    marginTop: 2,
  },
  branchPhone: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
    marginTop: 4,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  branchPhoneEmpty: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g400,
    fontStyle: 'italic',
    marginTop: 4,
  },
  branchActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g500,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  msgText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    ...shadow.sl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
  },
  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  typeIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  typeSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
})
