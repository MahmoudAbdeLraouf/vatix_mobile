import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_QUICK_REPLIES,
  firstServerId,
  lastServerId,
  makeTextDraft,
  resolveQuickReplies,
  setLocalState,
  uuidv4,
} from './thread.ts'
import type { LocalMessage } from './types.ts'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function draft(id: number): LocalMessage {
  return makeTextDraft({ tempId: id, conversationId: 1, senderId: 7, text: 'hi', clientMsgId: 'x', now: '2026-11-09T10:00:00.000Z' })
}

test('resolveQuickReplies falls back to defaults and fills a missing language', () => {
  assert.deepEqual(resolveQuickReplies(null), DEFAULT_QUICK_REPLIES)
  assert.deepEqual(resolveQuickReplies([{ ar: ' ', en: '' }]), DEFAULT_QUICK_REPLIES)
  assert.deepEqual(resolveQuickReplies([{ ar: 'متاح؟' }, { en: 'Price?' }, 5]), [
    { ar: 'متاح؟', en: 'متاح؟' },
    { ar: 'Price?', en: 'Price?' },
  ])
})

test('server id cursors ignore pending (negative) bubbles', () => {
  const msgs = [{ ...draft(5) }, { ...draft(9) }, draft(-1)]
  assert.equal(lastServerId(msgs), 9)
  assert.equal(firstServerId(msgs), 5)
  assert.equal(lastServerId([draft(-2)]), 0)
  assert.equal(firstServerId([]), 0)
})

test('makeTextDraft starts as sending and setLocalState flips it', () => {
  const d = draft(-3)
  assert.equal(d.localState, 'sending')
  assert.equal(d.caption, 'hi')
  assert.equal(setLocalState([d], -3, 'failed')[0].localState, 'failed')
})

test('uuidv4 fallback produces v4 ids', () => {
  const g = globalThis as { crypto?: unknown }
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
  try {
    assert.equal(g.crypto, undefined)
    const ids = new Set(Array.from({ length: 200 }, uuidv4))
    assert.equal(ids.size, 200)
    for (const id of ids) assert.match(id, V4)
  } finally {
    if (saved) Object.defineProperty(globalThis, 'crypto', saved)
  }
  assert.match(uuidv4(), V4)
})
