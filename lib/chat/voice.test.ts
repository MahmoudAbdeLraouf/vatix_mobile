import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CANCEL_DX, LOCK_DY, PLAYBACK_RATES, cancelProgress, clampDuration, finishDecision, interruptAction, meterToAmplitude, nextRate, playedFraction, rateLabel, recorderTick, seekFraction, slideIntent } from './voice.ts'

test('recorderTick: continues below 3:00, auto-stops at and past it', () => {
  assert.equal(recorderTick(0), 'continue')
  assert.equal(recorderTick(179_999), 'continue')
  assert.equal(recorderTick(180_000), 'autostop')
  assert.equal(recorderTick(181_200), 'autostop')
  assert.equal(recorderTick(Number.NaN), 'continue')
})

test('finishDecision: under 1 s is discarded, 1 s and longer is sent', () => {
  assert.equal(finishDecision(0), 'discard')
  assert.equal(finishDecision(999), 'discard')
  assert.equal(finishDecision(1_000), 'send')
  assert.equal(finishDecision(180_000), 'send')
  assert.equal(finishDecision(Number.NaN), 'discard')
})

test('clampDuration caps at 3:00 and rounds', () => {
  assert.equal(clampDuration(4_200.6), 4_201)
  assert.equal(clampDuration(185_000), 180_000)
  assert.equal(clampDuration(-5), 0)
  assert.equal(clampDuration(Number.NaN), 0)
})

test('slideIntent: RTL cancels toward the right, LTR toward the left', () => {
  assert.equal(slideIntent(CANCEL_DX, 0, true), 'cancel')
  assert.equal(slideIntent(-CANCEL_DX, 0, true), 'none')
  assert.equal(slideIntent(-CANCEL_DX, 0, false), 'cancel')
  assert.equal(slideIntent(CANCEL_DX, 0, false), 'none')
})

test('slideIntent: below the thresholds nothing happens, up locks', () => {
  assert.equal(slideIntent(CANCEL_DX - 1, 0, true), 'none')
  assert.equal(slideIntent(0, -(LOCK_DY - 1), true), 'none')
  assert.equal(slideIntent(0, -LOCK_DY, true), 'lock')
  assert.equal(slideIntent(0, -LOCK_DY, false), 'lock')
  assert.equal(slideIntent(0, LOCK_DY * 2, false), 'none')
})

test('slideIntent: when both are crossed, the larger overshoot wins', () => {
  assert.equal(slideIntent(CANCEL_DX + 80, -(LOCK_DY + 10), true), 'cancel')
  assert.equal(slideIntent(CANCEL_DX + 10, -(LOCK_DY + 80), true), 'lock')
})

test('cancelProgress ramps 0 to 1 toward the cancel side only', () => {
  assert.equal(cancelProgress(0, true), 0)
  assert.equal(cancelProgress(CANCEL_DX / 2, true), 0.5)
  assert.equal(cancelProgress(CANCEL_DX * 3, true), 1)
  assert.equal(cancelProgress(-40, true), 0)
  assert.equal(cancelProgress(-CANCEL_DX / 2, false), 0.5)
  assert.equal(cancelProgress(40, false), 0)
})

test('meterToAmplitude maps dBFS onto 0-1', () => {
  assert.equal(meterToAmplitude(0), 1)
  assert.equal(meterToAmplitude(-30), 0.5)
  assert.equal(meterToAmplitude(-60), 0)
  assert.equal(meterToAmplitude(-160), 0)
  assert.equal(meterToAmplitude(6), 1)
  assert.equal(meterToAmplitude(undefined), 0)
  assert.equal(meterToAmplitude(Number.NaN), 0)
})

test('nextRate cycles 1 → 1.5 → 2 → 1', () => {
  assert.deepEqual([...PLAYBACK_RATES], [1, 1.5, 2])
  assert.equal(nextRate(1), 1.5)
  assert.equal(nextRate(1.5), 2)
  assert.equal(nextRate(2), 1)
  assert.equal(nextRate(0.75), 1)
})

test('rateLabel', () => {
  assert.equal(rateLabel(1), '1×')
  assert.equal(rateLabel(1.5), '1.5×')
  assert.equal(rateLabel(2), '2×')
})

test('seekFraction mirrors in RTL and clamps', () => {
  assert.equal(seekFraction(25, 100, false), 0.25)
  assert.equal(seekFraction(25, 100, true), 0.75)
  assert.equal(seekFraction(-10, 100, false), 0)
  assert.equal(seekFraction(150, 100, false), 1)
  assert.equal(seekFraction(150, 100, true), 0)
  assert.equal(seekFraction(10, 0, false), 0)
})

test('playedFraction', () => {
  assert.equal(playedFraction(1_000, 4_000), 0.25)
  assert.equal(playedFraction(5_000, 4_000), 1)
  assert.equal(playedFraction(-1, 4_000), 0)
  assert.equal(playedFraction(1_000, 0), 0)
})

test('interruptAction: leaving active cancels a live recording, aborts a start, else nothing', () => {
  for (const st of ['background', 'inactive', 'blur']) {
    assert.equal(interruptAction('recording', st), 'cancel')
    assert.equal(interruptAction('locked', st), 'cancel')
    assert.equal(interruptAction('starting', st), 'abort-start')
    assert.equal(interruptAction('idle', st), 'none')
    assert.equal(interruptAction('stopping', st), 'none')
  }
  assert.equal(interruptAction('recording', 'active'), 'none')
  assert.equal(interruptAction('locked', 'active'), 'none')
})
