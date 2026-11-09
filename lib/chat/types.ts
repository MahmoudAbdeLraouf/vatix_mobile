// Mirrors vatix_backend/src/chat/message-view.ts and chat.service.ts.
// Kept free of runtime code and path aliases so node's type-stripping test runner can import it.

export type ChatAttachment = {
  id: number
  kind: 'image' | 'voice'
  url: string
  thumbUrl: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  waveform: number[] | null
  position: number
}

export type ChatMessageType = 'text' | 'image' | 'voice'

export type BroStep = 'ask' | 'form' | 'thanks' | 'sold_confirm' | 'price_update'

export type ChatMessage = {
  id: number
  conversationId: number
  senderId: number
  type: ChatMessageType
  /** Always non-empty for image/voice (legacy-client text). */
  content: string
  /** Raw stored text (image caption / text body). */
  caption: string
  attachments: ChatAttachment[]
  clientMsgId: string | null
  isRead: boolean
  meta: { bro: { inquiryId: number; step: BroStep; actions: string[] } } | null
  /** ISO string over JSON. */
  createdAt: string
}

/**
 * A file picked/recorded locally and not yet confirmed by the server.
 * `previewUrl` is an object URL owned by the UI layer: whoever creates it must
 * `URL.revokeObjectURL` it once the bubble is confirmed, discarded or unmounted.
 * `mergeMessages` drops confirmed pending bubbles without revoking anything.
 */
export type LocalUpload = {
  file: Blob
  kind: 'image' | 'voice'
  previewUrl: string
  durationMs?: number
  waveform?: number[]
}

/** Optimistic message: negative temp `id` until the server echo replaces it. */
export type LocalMessage = ChatMessage & {
  localState?: 'sending' | 'failed'
  localFiles?: LocalUpload[]
}

export type ChatProductSummary = {
  id: number
  slug: string | null
  title: string
  image: string | null
  ownerId: number
}

export type ChatOtherUser = {
  id: number
  displayName: string
  isBro: boolean
  isStore: boolean
  logo: string | null
}

export type InboxItem = {
  id: number
  productId: number | null
  product: ChatProductSummary | null
  createdAt: string
  updatedAt: string
  otherUser: ChatOtherUser
  lastMessage: {
    id: number
    type: ChatMessageType
    content: string
    senderId: number
    createdAt: string
    isRead: boolean
  } | null
  unreadCount: number
}

export type InboxPage = { items: InboxItem[]; nextCursor: string | null }

/** Conversation as returned alongside a page of messages (entity fields + product + otherUser). */
export type ChatConversation = {
  id: number
  user1Id: number
  user2Id: number
  productId: number | null
  lastMessageId: number | null
  /** Where the conversation was started from (null on historical rows). */
  platform: 'web' | 'mobile' | null
  appPlatform: 'web' | 'ios' | 'android' | null
  createdAt: string
  updatedAt: string
  product: ChatProductSummary | null
  otherUser: ChatOtherUser
}

export type QuickReply = { ar: string; en: string }

export type TypingKind = 'text' | 'voice'

/** Server -> client socket events. */
export type ChatEventMap = {
  'message:new': { message: ChatMessage; conversation: InboxItem }
  'conversation:updated': { conversation: InboxItem }
  'unread:count': { count: number }
  typing: { conversationId: number; userId: number; kind: TypingKind; on: boolean }
  presence: { userId: number; online: boolean }
}
