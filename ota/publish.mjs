#!/usr/bin/env node
// Vatix OTA publisher — replaces `eas update`.
//
//   npm run ota -- publish -m "fix checkout button"     export + sign + upload + go live
//   npm run ota -- history                               list recent updates per platform
//   npm run ota -- rollback --to <updateId>              re-publish an older update (new id, new date)
//   npm run ota -- rollback-embedded                     send devices back to the bundle inside the binary
//
// Flags: --platform ios|android|all (default all), --channel <name> (default production),
//        --runtime <version> (default: resolved from this project), --yes (skip confirmation),
//        --dry-run (publish only: export + sign, upload nothing).
//
// Signing happens here with ~/.vatix-ota/keys/private-key.pem; the server only stores signed bytes.

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOME = path.join(os.homedir(), '.vatix-ota')
const SERVER = (process.env.OTA_SERVER ?? 'https://updates.vatix.store').replace(/\/$/, '')
const KEY_PATH = process.env.OTA_PRIVATE_KEY ?? path.join(HOME, 'keys', 'private-key.pem')
const TOKEN_PATH = process.env.OTA_ADMIN_TOKEN_FILE ?? path.join(HOME, 'admin-token')
const OUT = path.join(ROOT, 'ota', '.dist')
const HISTORY_LIMIT = 30

const CONTENT_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
  json: 'application/json', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', lottie: 'application/json',
}

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const command = argv[0]
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)
const message = flag('message') ?? flag('m') ?? (argv.includes('-m') ? argv[argv.indexOf('-m') + 1] : undefined)
const channel = flag('channel') ?? 'production'
const platformArg = flag('platform') ?? 'all'
const platforms = platformArg === 'all' ? ['ios', 'android'] : [platformArg]
if (!platforms.every((p) => p === 'ios' || p === 'android')) die(`Unknown --platform ${platformArg}`)
if (!/^[\w.-]+$/.test(channel)) die(`Bad --channel ${channel}`)

// ── helpers ─────────────────────────────────────────────────────────────────
function die(msg) {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
}

function productionEnv() {
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'))
  const env = eas.build?.production?.env ?? {}
  if (!/^https:\/\//.test(env.EXPO_PUBLIC_API_URL ?? '')) die('eas.json production env has no https EXPO_PUBLIC_API_URL')
  // eas.json values win over the shell so a stray localhost export can't leak into a release.
  return { ...process.env, ...env, NODE_ENV: 'production' }
}

function resolveRuntime(platform, env) {
  if (flag('runtime')) return flag('runtime')
  // The CLI prints valid JSON but exits non-zero, so read stdout either way.
  let out
  try {
    out = run('node', [path.join(ROOT, 'node_modules/expo-updates/bin/cli.js'), 'runtimeversion:resolve', '--platform', platform], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    out = err.stdout ?? ''
  }
  const line = out.trim().split('\n').pop() ?? ''
  let runtime
  try {
    runtime = JSON.parse(line).runtimeVersion
  } catch {}
  if (!runtime) die(`Could not resolve runtime version for ${platform}`)
  return runtime
}

function sign(body) {
  if (!fs.existsSync(KEY_PATH)) die(`Signing key not found at ${KEY_PATH}`)
  const key = fs.readFileSync(KEY_PATH, 'utf8')
  const sig = crypto.createSign('RSA-SHA256').update(body, 'utf8').sign(key, 'base64')
  return `sig="${sig}", keyid="main"`
}

function gitInfo() {
  try {
    const commit = run('git', ['rev-parse', '--short', 'HEAD']).trim()
    const dirty = run('git', ['status', '--porcelain']).trim().length > 0
    return { commit, dirty }
  } catch {
    return { commit: 'unknown', dirty: true }
  }
}

function token() {
  if (!fs.existsSync(TOKEN_PATH)) die(`Admin token not found at ${TOKEN_PATH}`)
  return fs.readFileSync(TOKEN_PATH, 'utf8').trim()
}

async function api(method, key, body, contentType = 'application/json') {
  const url = `${SERVER}/_admin/object/${key}`
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { authorization: `Bearer ${token()}`, ...(body ? { 'content-type': contentType } : {}) },
        body,
      })
      if (res.status === 404 && method !== 'PUT') return null
      if (!res.ok) throw new Error(`${method} ${key} → HTTP ${res.status}`)
      return method === 'GET' ? res : true
    } catch (err) {
      if (attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
}

const pointerKey = (runtime, platform) => `pointers/${channel}/${runtime}/${platform}.json`
const historyKey = (runtime, platform) => `history/${channel}/${runtime}/${platform}.json`

async function readHistory(runtime, platform) {
  const res = await api('GET', historyKey(runtime, platform))
  return res ? await res.json() : []
}

async function readPointer(runtime, platform) {
  const res = await api('GET', pointerKey(runtime, platform))
  return res ? await res.json() : null
}

// History first, pointer last: devices only see the change once the pointer flips.
async function goLive(runtime, platform, pointer, entry) {
  const history = await readHistory(runtime, platform)
  history.unshift({ ...entry, kind: pointer.kind, id: pointer.id, body: pointer.body, signature: pointer.signature })
  await api('PUT', historyKey(runtime, platform), JSON.stringify(history.slice(0, HISTORY_LIMIT)))
  await api('PUT', pointerKey(runtime, platform), JSON.stringify(pointer))
}

async function ensureNoUpdateDirective() {
  const body = JSON.stringify({ type: 'noUpdateAvailable' })
  await api('PUT', 'directives/noUpdateAvailable.json', JSON.stringify({ body, signature: sign(body) }))
}

async function confirm(summary) {
  console.log(`\n${summary}\n`)
  if (has('yes')) return
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`This goes live to real devices on "${channel}". Type "yes" to continue: `)
  rl.close()
  if (answer.trim().toLowerCase() !== 'yes') die('Aborted.')
}

async function pool(items, size, fn) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

function describeAsset(file, ext, isLaunch) {
  const buf = fs.readFileSync(path.join(OUT, file))
  const sha = crypto.createHash('sha256').update(buf)
  const digest = sha.digest()
  const hex = digest.toString('hex')
  return {
    hex,
    buf,
    contentType: isLaunch ? 'application/javascript' : CONTENT_TYPES[ext] ?? 'application/octet-stream',
    entry: {
      hash: digest.toString('base64url'),
      key: crypto.createHash('md5').update(buf).digest('hex'),
      fileExtension: `.${isLaunch ? 'bundle' : ext}`,
      contentType: isLaunch ? 'application/javascript' : CONTENT_TYPES[ext] ?? 'application/octet-stream',
      url: `${SERVER}/assets/${hex}`,
    },
  }
}

// ── commands ────────────────────────────────────────────────────────────────
async function publish() {
  if (!message) die('Add a message: npm run ota -- publish -m "what changed"')
  const env = productionEnv()
  const git = gitInfo()
  const runtimes = Object.fromEntries(platforms.map((p) => [p, resolveRuntime(p, env)]))

  await confirm(
    [
      `Channel:   ${channel}`,
      ...platforms.map((p) => `${p.padEnd(9)}  runtime ${runtimes[p]}`),
      `API:       ${env.EXPO_PUBLIC_API_URL}`,
      `Commit:    ${git.commit}${git.dirty ? ' (uncommitted changes included!)' : ''}`,
      `Message:   ${message}`,
      has('dry-run') ? 'Mode:      DRY RUN (nothing uploaded)' : '',
    ].filter(Boolean).join('\n'),
  )

  fs.rmSync(OUT, { recursive: true, force: true })
  run('npx', ['expo', 'export', ...platforms.flatMap((p) => ['--platform', p]), '--output-dir', OUT, '--clear'], { env, stdio: 'inherit' })
  const expoConfig = JSON.parse(run('npx', ['expo', 'config', '--json', '--type', 'public'], { env }))
  const metadata = JSON.parse(fs.readFileSync(path.join(OUT, 'metadata.json'), 'utf8'))

  const createdAt = new Date().toISOString()
  const prepared = platforms.map((platform) => {
    const meta = metadata.fileMetadata[platform]
    const launch = describeAsset(meta.bundle, null, true)
    const assets = meta.assets.map((a) => describeAsset(a.path, a.ext, false))
    const manifest = {
      id: crypto.randomUUID(),
      createdAt,
      runtimeVersion: runtimes[platform],
      launchAsset: launch.entry,
      assets: assets.map((a) => a.entry),
      metadata: {},
      extra: { expoClient: expoConfig, eas: { projectId: expoConfig.extra?.eas?.projectId } },
    }
    const body = JSON.stringify(manifest)
    return { platform, runtime: runtimes[platform], files: [launch, ...assets], pointer: { kind: 'update', id: manifest.id, body, signature: sign(body) } }
  })

  if (has('dry-run')) {
    for (const p of prepared) console.log(`✓ ${p.platform}: ${p.files.length} files, update ${p.pointer.id} (not uploaded)`)
    return
  }

  const unique = new Map(prepared.flatMap((p) => p.files.map((f) => [f.hex, f])))
  let uploaded = 0
  await pool([...unique.values()], 6, async (f) => {
    if (await api('HEAD', `assets/${f.hex}`)) return
    await api('PUT', `assets/${f.hex}`, f.buf, f.contentType)
    uploaded++
  })
  console.log(`\n✓ Assets: ${uploaded} uploaded, ${unique.size - uploaded} already on server`)

  await ensureNoUpdateDirective()
  for (const p of prepared) {
    await goLive(p.runtime, p.platform, p.pointer, { createdAt, message, commit: git.commit, dirty: git.dirty })
    console.log(`✓ ${p.platform} live: update ${p.pointer.id} (runtime ${p.runtime})`)
  }
  console.log('\nDevices pick this up on their next cold start (applied on the launch after that).')
}

async function history() {
  const env = productionEnv()
  for (const platform of platforms) {
    const runtime = resolveRuntime(platform, env)
    const [entries, pointer] = await Promise.all([readHistory(runtime, platform), readPointer(runtime, platform)])
    console.log(`\n${platform} · channel ${channel} · runtime ${runtime}`)
    if (!entries.length) console.log('  (no updates published)')
    for (const e of entries) {
      const live = pointer && pointer.body === e.body ? '● live' : '      '
      const what = e.kind === 'rollBackToEmbedded' ? 'rollback → embedded bundle' : e.id
      console.log(`  ${live}  ${e.createdAt}  ${what}  ${e.commit ?? ''}${e.dirty ? '*' : ''}  ${e.message ?? ''}`)
    }
  }
}

async function rollback() {
  const target = flag('to')
  if (!target) die('Usage: npm run ota -- rollback --to <updateId>   (see `npm run ota -- history`)')
  const env = productionEnv()
  const git = gitInfo()
  const plan = []
  for (const platform of platforms) {
    const runtime = resolveRuntime(platform, env)
    const old = (await readHistory(runtime, platform)).find((e) => e.kind === 'update' && e.id === target)
    if (!old) {
      if (platforms.length === 1) die(`Update ${target} not found in ${platform} history`)
      continue
    }
    plan.push({ platform, runtime, old })
  }
  if (!plan.length) die(`Update ${target} not found. Run \`npm run ota -- history\`; pass --platform for single-platform ids.`)

  await confirm(plan.map((p) => `${p.platform}: re-publish ${p.old.id} from ${p.old.createdAt} ("${p.old.message}")`).join('\n'))

  // Devices only switch to a *newer* update, so a rollback is the old bundle under a new id + date.
  const createdAt = new Date().toISOString()
  await ensureNoUpdateDirective()
  for (const p of plan) {
    const manifest = { ...JSON.parse(p.old.body), id: crypto.randomUUID(), createdAt }
    const body = JSON.stringify(manifest)
    await goLive(p.runtime, p.platform, { kind: 'update', id: manifest.id, body, signature: sign(body) }, {
      createdAt,
      message: `rollback to ${p.old.id}: ${p.old.message ?? ''}`.trim(),
      commit: p.old.commit,
      dirty: p.old.dirty,
    })
    console.log(`✓ ${p.platform} live: ${manifest.id} (copy of ${p.old.id})`)
  }
}

async function rollbackEmbedded() {
  const env = productionEnv()
  const runtimes = Object.fromEntries(platforms.map((p) => [p, resolveRuntime(p, env)]))
  await confirm(platforms.map((p) => `${p}: roll devices on runtime ${runtimes[p]} back to the bundle inside the app binary`).join('\n'))
  const createdAt = new Date().toISOString()
  const body = JSON.stringify({ type: 'rollBackToEmbedded', parameters: { commitTime: createdAt } })
  await ensureNoUpdateDirective()
  for (const platform of platforms) {
    await goLive(runtimes[platform], platform, { kind: 'rollBackToEmbedded', body, signature: sign(body) }, {
      createdAt,
      message: 'rollback to embedded bundle',
    })
    console.log(`✓ ${platform}: rollback-to-embedded is live`)
  }
}

const commands = { publish, history, rollback, 'rollback-embedded': rollbackEmbedded }
if (!commands[command]) die(`Usage: npm run ota -- <${Object.keys(commands).join('|')}> [flags]`)
await commands[command]().catch((err) => die(err.message ?? String(err)))
