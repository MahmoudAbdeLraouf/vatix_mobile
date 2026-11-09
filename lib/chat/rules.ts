import type { ChatConversation } from './types.ts'

/**
 * Quick-reply chips are for the buyer only: not the product owner, only on an empty
 * product-scoped thread, and never in a Vatix Bro thread.
 */
export function shouldShowChips(args: { me: number; conversation: ChatConversation; messageCount: number }): boolean {
  const { me, conversation, messageCount } = args
  if (messageCount > 0) return false
  if (!conversation.product || conversation.productId == null) return false
  if (conversation.otherUser.isBro) return false
  if (conversation.product.ownerId === me) return false
  return true
}
