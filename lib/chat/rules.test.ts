import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowChips } from './rules.ts'
import type { ChatConversation } from './types.ts'

const ME = 1
const OWNER = 2

function conv(over: Partial<ChatConversation> = {}): ChatConversation {
  return {
    id: 1,
    user1Id: ME,
    user2Id: OWNER,
    productId: 9,
    lastMessageId: null,
    platform: null,
    appPlatform: null,
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
    product: { id: 9, slug: 'p', title: 'Phone', image: null, ownerId: OWNER },
    otherUser: { id: OWNER, displayName: 'Seller', isBro: false, isStore: false, logo: null },
    ...over,
  }
}

test('shouldShowChips table', () => {
  const cases: Array<[string, { me: number; conversation: ChatConversation; messageCount: number }, boolean]> = [
    ['owner', { me: OWNER, conversation: conv(), messageCount: 0 }, false],
    [
      'bro',
      { me: ME, conversation: conv({ otherUser: { ...conv().otherUser, isBro: true } }), messageCount: 0 },
      false,
    ],
    ['no product', { me: ME, conversation: conv({ product: null, productId: null }), messageCount: 0 }, false],
    ['non-empty thread', { me: ME, conversation: conv(), messageCount: 1 }, false],
    ['buyer, empty thread, product', { me: ME, conversation: conv(), messageCount: 0 }, true],
  ]
  for (const [name, args, expected] of cases) {
    assert.equal(shouldShowChips(args), expected, name)
  }
})
