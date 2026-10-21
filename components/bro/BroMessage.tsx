import React, { useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { translations } from '@/lib/i18n'
import {
  answerBroAvailability,
  broMarkSold,
  broUpdatePrice,
  setBroOptOut,
  submitBroFreeText,
  type BroMessageMeta,
  type BroStep,
} from '@/lib/bro'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { BroButton } from '@/components/bro/BroButton'
import { BroDetailsForm } from '@/components/bro/BroDetailsForm'

export interface BroChatMessage {
  id: number
  content: string
  meta: BroMessageMeta
  createdAt: string
}

// Bro system messages are authored in Arabic by the backend, so the markers we strip
// from the stored content come from the Arabic dictionary regardless of the UI locale.
const AR = translations.ar.bro

// The backend appends the seller deep link ("<site>/bro/i/<id>") on its own line; the
// quick replies replace it, so it never shows in the bubble.
const LINK_LINE = /^\S*\/bro\/i\/\d+\s*$/
// Price-update / sold-confirm prompts end with an inline "yes · no" hint; the buttons replace it.
const INLINE_YES_NO = new RegExp(`\\s*${AR.yes}\\s*·\\s*${AR.no}\\s*$`)

function splitContent(
  content: string,
  step: BroStep,
): { banner: string | null; body: string; hasOptOutFooter: boolean } {
  const paragraphs = content
    .split('\n\n')
    .map((p) =>
      p
        .split('\n')
        .filter((line) => !LINK_LINE.test(line))
        .join('\n')
        .trim(),
    )
    .filter((p) => p.length > 0)

  let banner: string | null = null
  let hasOptOutFooter = false

  if (step === 'ask') {
    if (paragraphs[0]?.startsWith('🤖')) banner = paragraphs.shift() ?? null
    const i = paragraphs.findIndex((p) => p.startsWith(AR.optOutPrompt))
    if (i !== -1) {
      paragraphs.splice(i, 1)
      hasOptOutFooter = true
    }
  }

  let body = paragraphs.join('\n\n')
  if (step === 'price_update' || step === 'sold_confirm') body = body.replace(INLINE_YES_NO, '')
  return { banner, body, hasOptOutFooter }
}

function timeLabel(iso: string, ar: boolean): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

/** Renders a Vatix Bro system message (message.meta.bro) with its quick-reply actions. */
export function BroMessage({
  message,
  onAnswered,
}: {
  message: BroChatMessage
  onAnswered: () => void
}) {
  const { t, locale } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const { inquiryId, step, actions } = message.meta.bro
  const { banner, body, hasOptOutFooter } = splitContent(message.content, step)

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [optedOut, setOptedOut] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  // Ref guard: state updates are async, so two quick taps could both pass a `busy` check.
  const inFlight = useRef(false)

  const locked = busy || done
  const isPrompt = step === 'price_update' || step === 'sold_confirm'
  const showActions = !dismissed

  /** Runs one server action. Returns true on success. `finalize` marks the message answered. */
  async function run(call: () => Promise<unknown>, finalize = true): Promise<boolean> {
    if (locked || inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await call()
      if (finalize) setDone(true)
      return true
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : b.errGeneric)
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function answer(call: () => Promise<unknown>) {
    if (await run(call)) onAnswered()
  }

  async function optOut() {
    if (optedOut) return
    // Opt-out does not answer the question, so it must not lock the quick replies.
    if (await run(() => setBroOptOut(true), false)) setOptedOut(true)
  }

  function submitFreeText() {
    const trimmed = text.trim()
    if (!trimmed) return
    void answer(() => submitBroFreeText(inquiryId, trimmed))
  }

  const quick: { key: string; label: string; onPress: () => void }[] = []
  for (const action of actions) {
    switch (action) {
      case 'available':
        quick.push({ key: action, label: b.qrAvailable, onPress: () => void answer(() => answerBroAvailability(inquiryId, true)) })
        break
      case 'sold':
        quick.push({ key: action, label: b.qrSold, onPress: () => void answer(() => answerBroAvailability(inquiryId, false)) })
        break
      case 'free_text':
        quick.push({ key: action, label: b.qrOwnReply, onPress: () => setReplying((v) => !v) })
        break
      case 'update_price':
        quick.push({ key: action, label: b.yes, onPress: () => void answer(() => broUpdatePrice(inquiryId)) })
        break
      case 'mark_sold':
        quick.push({ key: action, label: b.yes, onPress: () => void answer(() => broMarkSold(inquiryId)) })
        break
      case 'dismiss':
        quick.push({ key: action, label: b.no, onPress: () => setDismissed(true) })
        break
    }
  }

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, isPrompt ? styles.bubblePrompt : styles.bubblePlain]}>
        <View style={[styles.header, rowDir]}>
          <BroAvatar size={20} />
          <Text style={[styles.name, dirStyle]}>{b.name}</Text>
        </View>

        {banner && (
          <View style={styles.banner}>
            <Text style={[styles.bannerText, dirStyle]}>{banner}</Text>
          </View>
        )}

        {body.length > 0 && <Text style={[styles.body, dirStyle]}>{body}</Text>}

        {showActions && quick.length > 0 && (
          <View style={[styles.actions, rowDir]}>
            {quick.map((q) => (
              <BroButton
                key={q.key}
                label={q.label}
                disabled={locked}
                variant={q.key === 'free_text' && replying ? 'dark' : 'outline'}
                selected={q.key === 'free_text' ? replying : undefined}
                onPress={q.onPress}
                dirStyle={dirStyle}
              />
            ))}
          </View>
        )}

        {showActions && replying && !done && (
          <View style={styles.reply}>
            <TextInput
              value={text}
              onChangeText={setText}
              editable={!busy}
              multiline
              maxLength={2000}
              placeholder={b.freeTextPlaceholder}
              placeholderTextColor={colors.g400}
              style={[styles.input, dirStyle]}
            />
            <View style={[styles.sendRow, rowDir]}>
              <BroButton
                label={busy ? '...' : b.sellerSend}
                variant="dark"
                disabled={busy || text.trim() === ''}
                onPress={submitFreeText}
                dirStyle={dirStyle}
              />
            </View>
          </View>
        )}

        {showActions && actions.includes('details') && (
          <BroDetailsForm
            inquiryId={inquiryId}
            disabled={done}
            onSubmitted={() => {
              setDone(true)
              onAnswered()
            }}
          />
        )}

        {hasOptOutFooter && actions.includes('opt_out') && (
          <View style={[styles.optOut, rowDir]}>
            <Text style={[styles.optOutText, dirStyle]}>{optedOut ? b.optOutDone : b.optOutPrompt}</Text>
            <BroButton
              label={optedOut ? `✓ ${b.optOutAction}` : b.optOutAction}
              disabled={busy || optedOut}
              onPress={() => void optOut()}
              dirStyle={dirStyle}
            />
          </View>
        )}

        {error && (
          <Text style={[styles.error, dirStyle]} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Text style={[styles.time, dirStyle]}>{timeLabel(message.createdAt, ar)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Bro messages align like the other party's bubbles in this screen.
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderTopEndRadius: 4,
    borderWidth: 1,
  },
  bubblePlain: { backgroundColor: colors.white, borderColor: colors.g200 },
  bubblePrompt: { backgroundColor: '#fff8e1', borderColor: colors.y },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  name: { fontFamily: fonts.bold, fontSize: 12, color: colors.dk },
  banner: {
    backgroundColor: colors.g100,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  bannerText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.g500 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.g900 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  reply: { marginTop: 8, gap: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 64,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },
  sendRow: { flexDirection: 'row' },
  optOut: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  optOutText: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500, flexShrink: 1 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.red, marginTop: 6 },
  time: { fontFamily: fonts.regular, fontSize: 10, color: colors.g500, opacity: 0.6, marginTop: 4 },
})
