import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeMessages } from './merge.ts'
import type { ChatMessage, LocalMessage } from './types.ts'

function server(id: number, over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    conversationId: 1,
    senderId: 7,
    type: 'text',
    content: `m${id}`,
    caption: `m${id}`,
    attachments: [],
    clientMsgId: null,
    isRead: false,
    meta: null,
    createdAt: '2026-11-09T10:00:00.000Z',
    ...over,
  }
}

function pending(tempId: number, clientMsgId: string): LocalMessage {
  return { ...server(tempId, { clientMsgId }), localState: 'sending' }
}

test('pending bubble is replaced, not duplicated, when socket echo arrives before the POST resolves', () => {
  const sent = server(50, { clientMsgId: 'abc', content: 'hi', caption: 'hi' })
  let list: LocalMessage[] = [pending(-1, 'abc')]
  list = mergeMessages(list, [sent]) // socket echo
  list = mergeMessages(list, [sent]) // POST response
  assert.equal(list.length, 1)
  assert.equal(list[0].id, 50)
  assert.equal(list[0].localState, undefined)
})

test('merging the same server message twice keeps one copy', () => {
  const m = server(10)
  const once = mergeMessages([], [m])
  const twice = mergeMessages(once, [m])
  assert.equal(twice.length, 1)
  assert.equal(twice[0].id, 10)
})

test('sorts server messages by id and keeps pending ones last', () => {
  const p1 = pending(-1, 'p1')
  const p2 = pending(-2, 'p2')
  const list = mergeMessages([server(5), p1, p2], [server(3), server(9), server(4)])
  assert.deepEqual(
    list.map((m) => m.id),
    [3, 4, 5, 9, -1, -2],
  )
})

test('incoming message replaces a matching pending bubble in place of the pending slot, others stay last', () => {
  const list = mergeMessages([server(5), pending(-1, 'a'), pending(-2, 'b')], [server(6, { clientMsgId: 'a' })])
  assert.deepEqual(
    list.map((m) => m.id),
    [5, 6, -2],
  )
  assert.equal(list[1].localState, undefined)
})

test('duplicate ids in one batch: last write wins', () => {
  const list = mergeMessages([], [server(1, { content: 'old' }), server(1, { content: 'new' })])
  assert.equal(list.length, 1)
  assert.equal(list[0].content, 'new')
})

test('a failed pending bubble is kept (and stays last) when unrelated messages arrive', () => {
  const failed: LocalMessage = { ...pending(-1, 'x'), localState: 'failed' }
  const list = mergeMessages([failed], [server(2)])
  assert.deepEqual(
    list.map((m) => m.id),
    [2, -1],
  )
  assert.equal(list[1].localState, 'failed')
})
