import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
import { Link } from 'expo-router'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { StarRating } from '@/components/StarRating'
import { Button } from '@/components/ui/Button'
import { getProductRatings, ProductRatingItem } from '@/lib/api'
import { authFetch, authPost, authDeleteJson, isLoggedIn } from '@/lib/auth'

interface Props {
  productId: number
  initialAvg: number
  initialCount: number
  ownerId?: number
}

export function RatingSection({ productId, initialAvg, initialCount, ownerId }: Props) {
  const { t, locale, isRtl } = useLocale()
  const { user } = useAuth()

  const [avg, setAvg] = useState(initialAvg)
  const [count, setCount] = useState(initialCount)
  const [ratings, setRatings] = useState<ProductRatingItem[]>([])
  const [myRating, setMyRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')

  const isOwner = ownerId != null && user?.id === ownerId

  const refreshRatings = useCallback(() => {
    setLoadingList(true)
    setListError('')
    getProductRatings(productId)
      .then((data) => setRatings(data))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log('[RatingSection] failed to load ratings', err)
        setListError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoadingList(false))
  }, [productId])

  useEffect(() => {
    let cancelled = false
    refreshRatings()
    isLoggedIn().then(async (loggedInNow) => {
      if (cancelled) return
      setLoggedIn(loggedInNow)
      if (!loggedInNow) return
      try {
        const mine = await authFetch<ProductRatingItem | null>(`/products/${productId}/my-rating`)
        if (cancelled || !mine) return
        setMyRating(mine.rating)
        setComment(mine.comment ?? '')
      } catch {
        /* ignore */
      }
    })
    return () => {
      cancelled = true
    }
  }, [productId, refreshRatings])

  async function handleSubmit() {
    if (!myRating) {
      setError(t.selectStars)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await authPost<{ averageRating: number; ratingsCount: number }>(
        `/products/${productId}/rate`,
        { rating: myRating, comment: comment.trim() || undefined },
      )
      setAvg(res.averageRating)
      setCount(res.ratingsCount)
      setSuccess(t.reviewSaved)
      refreshRatings()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.reviewSaveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await authDeleteJson<{ averageRating: number; ratingsCount: number }>(
        `/products/${productId}/rate`,
      )
      if (res) {
        setAvg(res.averageRating)
        setCount(res.ratingsCount)
      }
      setMyRating(0)
      setComment('')
      setSuccess(t.reviewDeleted)
      refreshRatings()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  function timeAgo(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 60) return t.minutesAgo(m)
    if (m < 1440) return t.hoursAgo(Math.floor(m / 60))
    return t.daysAgo(Math.floor(m / 1440))
  }

  const descriptors = locale === 'ar'
    ? ['', t.starPoor, t.starFair, t.starGood, t.starVeryGood, t.starExcellent]
    : ['', t.starPoor, t.starFair, t.starGood, t.starVeryGood, t.starExcellent]

  const showForm = loggedIn && !isOwner
  const showSignInPrompt = !loggedIn

  return (
    <View style={styles.card}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{t.reviews}</Text>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryLeft}>
          <Text style={styles.avgValue}>{avg > 0 ? avg.toFixed(1) : '—'}</Text>
          <StarRating value={avg} size={18} />
          <Text style={styles.summaryMeta}>
            {count > 0 ? t.reviewsCount(count) : t.noReviewsYet}
          </Text>
        </View>

        <View style={styles.summaryRight}>
          {[5, 4, 3, 2, 1].map((star) => {
            const n = ratings.filter((r) => r.rating === star).length
            const pct = count > 0 ? Math.round((n / count) * 100) : 0
            return (
              <View key={star} style={styles.barRow}>
                <Text style={styles.barLabel}>{star}</Text>
                <Text style={styles.barStar}>★</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.barCount}>{n > 0 ? String(n) : ''}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Rate form */}
      {showForm ? (
        <View style={styles.formBlock}>
          <Text style={styles.formTitle}>
            {myRating ? t.editReview : t.addReview}
          </Text>

          <View style={styles.formStarsRow}>
            <StarRating value={myRating} interactive size={28} onChange={setMyRating} />
            {myRating > 0 ? (
              <Text style={styles.descriptor}>{descriptors[myRating]}</Text>
            ) : null}
          </View>

          <TextInput
            style={[styles.textArea, { textAlign: isRtl ? 'right' : 'left' }]}
            multiline
            numberOfLines={3}
            placeholder={t.reviewCommentPlaceholder}
            placeholderTextColor={colors.g400}
            value={comment}
            onChangeText={setComment}
          />

          {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
          {success ? <Text style={styles.successText}>✓ {success}</Text> : null}

          <View style={styles.formActions}>
            <View style={styles.actionButton}>
              <Button
                label={saving ? t.savingReview : t.saveReview}
                variant="y"
                size="sm"
                loading={saving}
                fullWidth
                onPress={handleSubmit}
              />
            </View>
            {myRating > 0 ? (
              <View style={styles.actionButton}>
                <Button
                  label={t.deleteReview}
                  variant="red"
                  size="sm"
                  fullWidth
                  disabled={saving}
                  onPress={handleDelete}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : showSignInPrompt ? (
        <View style={styles.signInBlock}>
          <Text style={styles.signInText}>
            <Link href={`/(auth)/login?from=/products/${productId}`} style={styles.signInLink}>
              {t.signIn}
            </Link>
            {' '}
            {t.signInToReview}
          </Text>
        </View>
      ) : null}

      {/* Reviews list */}
      <View style={styles.reviewsList}>
        {loadingList ? (
          <View style={styles.listStatus}>
            <ActivityIndicator size="small" color={colors.y} />
          </View>
        ) : listError ? (
          <Text style={styles.errorText}>⚠️ {listError}</Text>
        ) : ratings.length === 0 ? (
          <Text style={styles.emptyListText}>{t.noReviewsYet}</Text>
        ) : (
          ratings.map((r) => (
            <View key={r.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarGlyph}>👤</Text>
                </View>
                <View style={styles.reviewMeta}>
                  <StarRating value={r.rating} size={13} />
                  <Text style={styles.reviewTime}>{timeAgo(r.createdAt)}</Text>
                </View>
              </View>
              {r.comment ? (
                <Text style={[styles.reviewComment, { textAlign: isRtl ? 'right' : 'left' }]}>
                  {r.comment}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    backgroundColor: colors.y,
    borderRadius: 2,
    marginEnd: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.dk,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryLeft: {
    alignItems: 'center',
    minWidth: 90,
  },
  avgValue: {
    fontFamily: fonts.black,
    fontSize: 42,
    color: colors.dk,
    lineHeight: 46,
  },
  summaryMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    marginTop: 4,
  },
  summaryRight: {
    flex: 1,
    minWidth: 140,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  barLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    width: 12,
    textAlign: 'center',
  },
  barStar: {
    color: colors.y,
    fontSize: 11,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.g200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.y,
    borderRadius: 3,
  },
  barCount: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    width: 22,
    textAlign: 'center',
  },
  formBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.g100,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  formTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.dk,
    marginBottom: spacing.sm + 4,
  },
  formStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm + 4,
  },
  descriptor: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.g300,
    borderRadius: radius.sm,
    padding: 10,
    minHeight: 76,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.dk,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
    marginBottom: 6,
  },
  successText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.green,
    marginBottom: 6,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
  },
  signInBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.g100,
    paddingTop: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  signInText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
  },
  signInLink: {
    fontFamily: fonts.bold,
    color: colors.yd,
  },
  reviewsList: {
    borderTopWidth: 1,
    borderTopColor: colors.g100,
    paddingTop: spacing.md,
  },
  listStatus: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  emptyListText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  reviewItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontSize: 14,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewTime: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  reviewComment: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    lineHeight: 20,
    marginStart: 42,
  },
})
