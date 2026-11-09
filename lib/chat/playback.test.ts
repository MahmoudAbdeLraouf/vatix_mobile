import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPlaybackCoordinator } from './playback.ts'

test('claiming while another note owns the player yields the previous owner once', () => {
  const c = createPlaybackCoordinator()
  const yields: string[] = []
  c.claim('a', () => yields.push('a'))
  assert.equal(yields.length, 0)
  c.claim('b', () => yields.push('b'))
  assert.deepEqual(yields, ['a'])
  assert.equal(c.isOwner('b'), true)
  assert.equal(c.isOwner('a'), false)
})

test('re-claiming by the current owner does not yield itself', () => {
  const c = createPlaybackCoordinator()
  let yielded = 0
  c.claim('a', () => yielded++)
  c.claim('a', () => yielded++)
  assert.equal(yielded, 0)
  assert.equal(c.isOwner('a'), true)
})

test('release only works for the owner, and nobody is yielded after it', () => {
  const c = createPlaybackCoordinator()
  const yields: string[] = []
  c.claim('a', () => yields.push('a'))
  c.release('b')
  assert.equal(c.isOwner('a'), true)
  c.release('a')
  assert.equal(c.isOwner('a'), false)
  c.claim('b', () => yields.push('b'))
  assert.deepEqual(yields, [])
})

test('a stale yield cannot fire after ownership moved on', () => {
  const c = createPlaybackCoordinator()
  const yields: string[] = []
  c.claim('a', () => yields.push('a'))
  c.claim('b', () => yields.push('b'))
  c.claim('c', () => yields.push('c'))
  assert.deepEqual(yields, ['a', 'b'])
})
