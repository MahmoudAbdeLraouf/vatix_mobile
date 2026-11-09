import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_IMAGE_EDGE, resizeTarget } from './resize.ts'

test('resizeTarget: a landscape photo is capped at 1600 wide', () => {
  assert.equal(MAX_IMAGE_EDGE, 1600)
  assert.deepEqual(resizeTarget(4000, 3000), { width: 1600, height: 1200 })
})

test('resizeTarget: a portrait photo is capped at 1600 tall', () => {
  assert.deepEqual(resizeTarget(3024, 4032), { width: 1200, height: 1600 })
})

test('resizeTarget: images that already fit are left alone', () => {
  assert.equal(resizeTarget(1600, 1600), null)
  assert.equal(resizeTarget(800, 600), null)
})

test('resizeTarget: just over the cap scales down', () => {
  assert.deepEqual(resizeTarget(1601, 1000), { width: 1600, height: 999 })
})

test('resizeTarget: extreme aspect ratios never collapse to zero', () => {
  assert.deepEqual(resizeTarget(16000, 10), { width: 1600, height: 1 })
})

test('resizeTarget: unknown or invalid sizes are not resized', () => {
  assert.equal(resizeTarget(null, 3000), null)
  assert.equal(resizeTarget(undefined, undefined), null)
  assert.equal(resizeTarget(0, 0), null)
  assert.equal(resizeTarget(Number.NaN, 4000), null)
  assert.equal(resizeTarget(Infinity, 4000), null)
})

test('resizeTarget: custom max', () => {
  assert.deepEqual(resizeTarget(2000, 1000, 1000), { width: 1000, height: 500 })
})
