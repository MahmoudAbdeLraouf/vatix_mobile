import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendPage, applyLiveUpdate, refreshFirstPage, upsertToTop } from './inbox.ts'
import type { InboxItem } from './types.ts'

function conv(id: number, over: Partial<InboxItem> = {}): InboxItem {
  return {
    id,
    productId: null,
    product: null,
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
    otherUser: { id: 100 + id, displayName: `u${id}`, isBro: false, isStore: false, logo: null },
    lastMessage: null,
    unreadCount: 0,
    ...over,
  }
}

const ids = (l: InboxItem[]) => l.map((c) => c.id)

test('upsertToTop moves an existing row to the top with its new data', () => {
  const out = upsertToTop([conv(1), conv(2), conv(3)], conv(3, { unreadCount: 4 }))
  assert.deepEqual(ids(out), [3, 1, 2])
  assert.equal(out[0].unreadCount, 4)
})

test('upsertToTop inserts an unknown row at the top', () => {
  assert.deepEqual(ids(upsertToTop([conv(1)], conv(9))), [9, 1])
})

test('applyLiveUpdate without a search behaves like upsertToTop', () => {
  assert.deepEqual(ids(applyLiveUpdate([conv(1), conv(2)], conv(7), false)), [7, 1, 2])
})

test('applyLiveUpdate during a search ignores rows that are not in the list', () => {
  const list = [conv(1), conv(2)]
  assert.equal(applyLiveUpdate(list, conv(7), true), list)
})

test('applyLiveUpdate during a search still updates and raises a row that is in the list', () => {
  const out = applyLiveUpdate([conv(1), conv(2)], conv(2, { unreadCount: 1 }), true)
  assert.deepEqual(ids(out), [2, 1])
  assert.equal(out[0].unreadCount, 1)
})

test('appendPage de-duplicates by id and keeps existing rows in place', () => {
  const live = conv(5, { unreadCount: 9 })
  const out = appendPage([live, conv(1)], [conv(1), conv(5), conv(2)])
  assert.deepEqual(ids(out), [5, 1, 2])
  assert.equal(out[0].unreadCount, 9)
})

test('appendPage de-duplicates within the incoming page', () => {
  assert.deepEqual(ids(appendPage([], [conv(1), conv(1), conv(2)])), [1, 2])
})

test('refreshFirstPage puts fresh rows first and keeps deeper loaded rows', () => {
  const out = refreshFirstPage([conv(1), conv(2), conv(3)], 'deep', [conv(2, { unreadCount: 2 }), conv(1)], 'p1')
  assert.deepEqual(ids(out.items), [2, 1, 3])
  assert.equal(out.items[0].unreadCount, 2)
  assert.equal(out.nextCursor, 'deep')
})

test('refreshFirstPage adopts the fresh cursor when only page one was loaded', () => {
  const out = refreshFirstPage([conv(1), conv(2)], 'old', [conv(2), conv(1), conv(3)], 'p1')
  assert.deepEqual(ids(out.items), [2, 1, 3])
  assert.equal(out.nextCursor, 'p1')
})
