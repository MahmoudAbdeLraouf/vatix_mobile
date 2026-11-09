import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WAVEFORM_BUCKETS, baseMime, downsamplePeaks, formatDuration, makeVoiceDraft, pickRecorderMime, voiceFileName, voiceMessageBody, voiceSource, voiceUploadFields, withUploadedVoice } from './waveform.ts'

test('downsamplePeaks: 1000 samples → 48 values', () => {
  const samples = Array.from({ length: 1000 }, (_, i) => Math.abs(Math.sin(i / 10)))
  const out = downsamplePeaks(samples)
  assert.equal(out.length, 48)
  assert.equal(WAVEFORM_BUCKETS, 48)
})

test('downsamplePeaks: all values are integers within 0–100', () => {
  const samples = Array.from({ length: 1000 }, (_, i) => (i % 7) * 0.31)
  const out = downsamplePeaks(samples)
  for (const v of out) {
    assert.ok(Number.isInteger(v), `${v} is not an integer`)
    assert.ok(v >= 0 && v <= 100, `${v} out of range`)
  }
  assert.equal(Math.max(...out), 100)
})

test('downsamplePeaks: empty input → 48 zeros', () => {
  assert.deepEqual(downsamplePeaks([]), new Array(48).fill(0))
})

test('downsamplePeaks: all-silent input → zeros, not NaN', () => {
  assert.deepEqual(downsamplePeaks(new Array(500).fill(0)), new Array(48).fill(0))
})

test('downsamplePeaks: takes the max per bucket', () => {
  const samples = new Array(96).fill(0.1)
  samples[5] = 1 // bucket 2 of 48 (2 samples per bucket)
  const out = downsamplePeaks(samples)
  assert.equal(out[2], 100)
  assert.equal(out[0], 10)
})

test('downsamplePeaks: fewer samples than buckets still yields 48 values', () => {
  const out = downsamplePeaks([0.5, 1])
  assert.equal(out.length, 48)
  assert.ok(out.includes(100))
  assert.ok(out.every(v => v >= 0 && v <= 100))
})

test('downsamplePeaks: negative and non-finite samples are treated as magnitude / zero', () => {
  const out = downsamplePeaks([-1, Number.NaN, 0.5, Infinity])
  assert.equal(out.length, 48)
  assert.ok(out.every(v => Number.isInteger(v) && v >= 0 && v <= 100))
  assert.equal(Math.max(...out), 100)
})

test('formatDuration renders m:ss', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(5_400), '0:05')
  assert.equal(formatDuration(65_000), '1:05')
  assert.equal(formatDuration(180_000), '3:00')
  assert.equal(formatDuration(-10), '0:00')
  assert.equal(formatDuration(Number.NaN), '0:00')
})

test('pickRecorderMime prefers audio/mp4, else webm opus', () => {
  assert.equal(pickRecorderMime(t => t === 'audio/mp4'), 'audio/mp4')
  assert.equal(pickRecorderMime(() => true), 'audio/mp4')
  assert.equal(pickRecorderMime(t => t === 'audio/webm;codecs=opus'), 'audio/webm;codecs=opus')
  assert.equal(pickRecorderMime(() => false), '')
})

test('baseMime strips codec parameters', () => {
  assert.equal(baseMime('audio/webm;codecs=opus'), 'audio/webm')
  assert.equal(baseMime('audio/mp4; codecs="mp4a.40.2"'), 'audio/mp4')
  assert.equal(baseMime('AUDIO/MP4'), 'audio/mp4')
  assert.equal(baseMime(''), '')
})

test('voiceFileName picks an extension for the mime', () => {
  assert.equal(voiceFileName('audio/mp4'), 'voice.m4a')
  assert.equal(voiceFileName('audio/webm'), 'voice.webm')
  assert.equal(voiceFileName('audio/ogg'), 'voice.ogg')
  assert.equal(voiceFileName('audio/aac'), 'voice.aac')
  assert.equal(voiceFileName(''), 'voice.webm')
})

// Mobile LocalUpload: a local file uri instead of a web Blob + previewUrl.
const local = { uri: 'file:///rec/voice.m4a', mime: 'audio/mp4', kind: 'voice' as const, durationMs: 4200, waveform: [1, 2, 3] }
const voiceAtt = { id: 7, kind: 'voice' as const, url: 'https://s/v.m4a', thumbUrl: null, width: null, height: null, durationMs: 4000, waveform: [9, 9], position: 3 }

test('makeVoiceDraft builds a sending voice bubble with no attachment yet', () => {
  const d = makeVoiceDraft({ tempId: -2, conversationId: 5, senderId: 1, localFile: local, clientMsgId: 'c1', now: '2026-11-09T00:00:00.000Z' })
  assert.equal(d.id, -2)
  assert.equal(d.type, 'voice')
  assert.equal(d.caption, '')
  assert.ok(d.content.length > 0)
  assert.deepEqual(d.attachments, [])
  assert.equal(d.localState, 'sending')
  assert.deepEqual(d.localFiles, [local])
  assert.equal(d.clientMsgId, 'c1')
})

test('voiceSource prefers the server attachment, falls back to the local recording', () => {
  const d = makeVoiceDraft({ tempId: -2, conversationId: 5, senderId: 1, localFile: local, clientMsgId: 'c1', now: 'n' })
  assert.deepEqual(voiceSource(d), { url: 'file:///rec/voice.m4a', durationMs: 4200, waveform: [1, 2, 3] })
  assert.deepEqual(voiceSource({ ...d, attachments: [voiceAtt] }), { url: 'https://s/v.m4a', durationMs: 4000, waveform: [9, 9] })
  assert.deepEqual(voiceSource({ ...d, attachments: [{ ...voiceAtt, durationMs: null, waveform: null }], localFiles: undefined }), { url: 'https://s/v.m4a', durationMs: 0, waveform: [] })
  assert.equal(voiceSource({ ...d, localFiles: undefined }), null)
})

test('voiceUploadFields serialises duration and waveform for the upload', () => {
  assert.deepEqual(voiceUploadFields(4200.7, [1, 2, 3]), { kind: 'voice', durationMs: '4201', waveform: '[1,2,3]' })
})

test('withUploadedVoice stores the attachment on the draft only (retry reuses the id)', () => {
  const d = makeVoiceDraft({ tempId: -2, conversationId: 5, senderId: 1, localFile: local, clientMsgId: 'c1', now: 'n' })
  const other = { ...d, id: -3, clientMsgId: 'c2' }
  const out = withUploadedVoice([d, other], -2, voiceAtt)
  assert.deepEqual(out[0].attachments, [voiceAtt])
  assert.deepEqual(out[0].localFiles, [local])
  assert.equal(out[1], other)
  assert.deepEqual(d.attachments, [])
})

test('voiceMessageBody posts the attachment id with no content', () => {
  assert.deepEqual(voiceMessageBody(7, 'c1'), { type: 'voice', attachmentIds: [7], clientMsgId: 'c1' })
  assert.ok(!('content' in voiceMessageBody(7, 'c1')))
})
