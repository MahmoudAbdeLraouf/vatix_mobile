import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  assetMime,
  capImages,
  gridLayout,
  gridSources,
  imagePreviewText,
  makeImageDraft,
  pagerIndexFromOffset,
  pagerPage,
  singleImageHeight,
  trayError,
  trayReady,
} from './images.ts'
import type { ChatAttachment, LocalMessage } from './types.ts'

function att(id: number, position: number, thumb = true): ChatAttachment {
  return {
    id,
    kind: 'image',
    url: `https://cdn/x/${id}.jpg`,
    thumbUrl: thumb ? `https://cdn/x/${id}_t.jpg` : null,
    width: 800,
    height: 600,
    durationMs: null,
    waveform: null,
    position,
  }
}

test('caps match the server', () => {
  assert.equal(MAX_IMAGES_PER_MESSAGE, 10)
  assert.equal(MAX_IMAGE_BYTES, 15 * 1024 * 1024)
})

test('capImages keeps what fits in the 10-image tray and flags overflow', () => {
  const pick = (n: number) => Array.from({ length: n }, (_, i) => i)
  assert.deepEqual(capImages(pick(3), 0), { accepted: [0, 1, 2], overflow: false })
  assert.deepEqual(capImages(pick(10), 0), { accepted: pick(10), overflow: false })
  assert.deepEqual(capImages(pick(12), 0), { accepted: pick(10), overflow: true })
  assert.deepEqual(capImages(pick(4), 8), { accepted: [0, 1], overflow: true })
  assert.deepEqual(capImages(pick(1), 10), { accepted: [], overflow: true })
  assert.deepEqual(capImages([], 10), { accepted: [], overflow: false })
  assert.deepEqual(capImages(pick(3), 1, 2), { accepted: [0], overflow: true })
})

test('gridLayout: 1 single, 2 side by side, 3-4 as 2x2, 5+ shows +N on the 4th tile', () => {
  assert.deepEqual(gridLayout(0), { shown: 0, extra: 0, spanLast: false })
  assert.deepEqual(gridLayout(1), { shown: 1, extra: 0, spanLast: false })
  assert.deepEqual(gridLayout(2), { shown: 2, extra: 0, spanLast: false })
  assert.deepEqual(gridLayout(3), { shown: 3, extra: 0, spanLast: true })
  assert.deepEqual(gridLayout(4), { shown: 4, extra: 0, spanLast: false })
  assert.deepEqual(gridLayout(5), { shown: 4, extra: 1, spanLast: false })
  assert.deepEqual(gridLayout(10), { shown: 4, extra: 6, spanLast: false })
})

test('singleImageHeight follows the aspect, clamped, with a 4:3 default', () => {
  assert.equal(singleImageHeight(200, null, null), 150)
  assert.equal(singleImageHeight(200, 800, 600), 150)
  assert.equal(singleImageHeight(200, 100, 1000), 270)
  assert.equal(singleImageHeight(200, 1000, 100), 100)
})

test('trayReady only when there is at least one image and every upload succeeded', () => {
  assert.equal(trayReady([]), false)
  assert.equal(trayReady([{ status: 'done' }, { status: 'done' }]), true)
  assert.equal(trayReady([{ status: 'done' }, { status: 'uploading' }]), false)
  assert.equal(trayReady([{ status: 'done' }, { status: 'error' }]), false)
})

test('trayError: 413 and oversized files cannot be retried, the rest can', () => {
  assert.equal(trayError(413), 'tooLarge')
  assert.equal(trayError(400), 'failed')
  assert.equal(trayError(0), 'failed')
  assert.equal(trayError(undefined), 'failed')
})

test('assetMime uses the picker mime, then the extension, then jpeg', () => {
  assert.equal(assetMime({ uri: 'file:///a.jpg', mimeType: 'image/png' }), 'image/png')
  assert.equal(assetMime({ uri: 'file:///a.PNG' }), 'image/png')
  assert.equal(assetMime({ uri: 'file:///a', fileName: 'IMG_1.HEIC' }), 'image/heic')
  assert.equal(assetMime({ uri: 'file:///a.webp' }), 'image/webp')
  assert.equal(assetMime({ uri: 'ph://abc' }), 'image/jpeg')
})

test('imagePreviewText mirrors the server preview', () => {
  assert.equal(imagePreviewText(1, ''), '📷 صورة')
  assert.equal(imagePreviewText(3, '  hi '), '📷 3 صور · hi')
})

test('makeImageDraft keeps uploaded ids for retry and local uris for the bubble', () => {
  const d = makeImageDraft({
    tempId: -3,
    conversationId: 4,
    senderId: 7,
    caption: ' look ',
    attachments: [att(11, 5), att(12, 9)],
    localFiles: [
      { uri: 'file:///1.jpg', mime: 'image/jpeg', kind: 'image', width: 10, height: 20 },
      { uri: 'file:///2.jpg', mime: 'image/jpeg', kind: 'image' },
    ],
    clientMsgId: 'cid',
    now: '2026-11-09T10:00:00.000Z',
  })
  assert.equal(d.type, 'image')
  assert.equal(d.caption, 'look')
  assert.equal(d.content, '📷 2 صور · look')
  assert.equal(d.localState, 'sending')
  assert.deepEqual(d.attachments.map((a) => [a.id, a.position]), [[11, 0], [12, 1]])
  assert.equal(d.localFiles?.length, 2)
})

test('gridSources shows local uris while pending, then server thumbs with stable cache keys', () => {
  const base = makeImageDraft({
    tempId: -1,
    conversationId: 1,
    senderId: 7,
    caption: '',
    attachments: [att(11, 0)],
    localFiles: [{ uri: 'file:///1.jpg', mime: 'image/jpeg', kind: 'image', width: 10, height: 20 }],
    clientMsgId: 'c',
    now: '',
  })
  assert.deepEqual(gridSources(base), [
    { key: 'local-0', thumb: { uri: 'file:///1.jpg' }, full: { uri: 'file:///1.jpg' }, width: 10, height: 20 },
  ])

  const echo: LocalMessage = { ...base, id: 50, localFiles: undefined, localState: undefined, attachments: [att(22, 1), att(21, 0, false)] }
  assert.deepEqual(gridSources(echo), [
    {
      key: 'att-21',
      thumb: { uri: 'https://cdn/x/21.jpg', cacheKey: 'attachment-21' },
      full: { uri: 'https://cdn/x/21.jpg', cacheKey: 'attachment-21' },
      width: 800,
      height: 600,
    },
    {
      key: 'att-22',
      thumb: { uri: 'https://cdn/x/22_t.jpg', cacheKey: 'attachment-22-thumb' },
      full: { uri: 'https://cdn/x/22.jpg', cacheKey: 'attachment-22' },
      width: 800,
      height: 600,
    },
  ])
})

test('gridSources ignores voice attachments', () => {
  const m: LocalMessage = {
    ...makeImageDraft({ tempId: 1, conversationId: 1, senderId: 1, caption: '', attachments: [], localFiles: [], clientMsgId: 'c', now: '' }),
    localFiles: undefined,
    attachments: [{ ...att(5, 0), kind: 'voice' }],
  }
  assert.deepEqual(gridSources(m), [])
})

test('pagerPage maps an image index to its pager page (LTR identity, RTL mirrored, clamped)', () => {
  assert.equal(pagerPage(0, 4, false), 0)
  assert.equal(pagerPage(2, 4, false), 2)
  assert.equal(pagerPage(0, 4, true), 3)
  assert.equal(pagerPage(3, 4, true), 0)
  assert.equal(pagerPage(1, 4, true), 2)
  assert.equal(pagerPage(9, 4, false), 3)
  assert.equal(pagerPage(-1, 4, true), 3)
  assert.equal(pagerPage(0, 1, true), 0)
  assert.equal(pagerPage(0, 0, true), 0)
})

test('pagerIndexFromOffset turns an LTR contentOffset.x into the image index', () => {
  const w = 390
  // LTR: page = offset / width.
  assert.equal(pagerIndexFromOffset(0, w, 5, false), 0)
  assert.equal(pagerIndexFromOffset(w * 3, w, 5, false), 3)
  assert.equal(pagerIndexFromOffset(w * 2 + 0.4, w, 5, false), 2) // sub-pixel snap
  // RTL: pages are laid out reversed, so the leftmost page is the last image.
  assert.equal(pagerIndexFromOffset(0, w, 5, true), 4)
  assert.equal(pagerIndexFromOffset(w * 4, w, 5, true), 0)
  assert.equal(pagerIndexFromOffset(w, w, 5, true), 3)
  // Overscroll / bounce and degenerate sizes stay in range.
  assert.equal(pagerIndexFromOffset(-40, w, 5, false), 0)
  assert.equal(pagerIndexFromOffset(w * 9, w, 5, false), 4)
  assert.equal(pagerIndexFromOffset(-40, w, 5, true), 4)
  assert.equal(pagerIndexFromOffset(500, 0, 5, false), 0)
  assert.equal(pagerIndexFromOffset(500, w, 0, true), 0)
})

test('pagerPage and pagerIndexFromOffset round-trip in both directions', () => {
  const w = 400
  for (const rtl of [false, true]) {
    for (let i = 0; i < 6; i++) {
      assert.equal(pagerIndexFromOffset(pagerPage(i, 6, rtl) * w, w, 6, rtl), i)
    }
  }
})
