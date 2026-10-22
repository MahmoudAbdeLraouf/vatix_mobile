// Self-hosted Expo Updates server (protocol v1) on Cloudflare Workers + R2.
//
// Manifests and directives are signed locally by `ota/publish.mjs` — the
// private key never reaches Cloudflare. This Worker only serves the pre-signed
// bytes, so a compromised Cloudflare account cannot push code to devices.
//
// R2 layout:
//   assets/<sha256hex>                          content-addressed bundle/asset bytes
//   pointers/<channel>/<runtime>/<platform>.json {kind, id?, body, signature}
//   history/<channel>/<runtime>/<platform>.json  publish log (written by the script)
//   directives/noUpdateAvailable.json            {body, signature}

export interface Env {
  OTA: R2Bucket
  ADMIN_TOKEN: string
  DEFAULT_CHANNEL: string
}

type SignedPayload = { body: string; signature: string }
type Pointer = SignedPayload & { kind: 'update' | 'rollBackToEmbedded'; id?: string }

const JSON_HEADERS = { 'content-type': 'application/json' }

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    try {
      if (url.pathname === '/manifest' || url.pathname === '/') return await manifest(req, url, env)
      if (url.pathname.startsWith('/assets/')) return await asset(req, url, env, ctx)
      if (url.pathname.startsWith('/_admin/')) return await admin(req, url, env)
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      console.error(err)
      return json({ error: 'Internal error' }, 500)
    }
  },
}

async function manifest(req: Request, url: URL, env: Env): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Expected GET' }, 405)

  const h = req.headers
  const platform = h.get('expo-platform') ?? url.searchParams.get('platform')
  if (platform !== 'ios' && platform !== 'android') return json({ error: 'Unsupported platform' }, 400)
  const runtime = h.get('expo-runtime-version') ?? url.searchParams.get('runtime-version')
  if (!runtime || !/^[\w.\-]+$/.test(runtime)) return json({ error: 'Missing runtime version' }, 400)
  const protocol = parseInt(h.get('expo-protocol-version') ?? '0', 10)
  if (protocol !== 1) return json({ error: 'Only expo-protocol-version 1 is supported' }, 400)

  // Unknown channels (e.g. production-apk) fall back to the default channel.
  const channel = h.get('expo-channel-name') || env.DEFAULT_CHANNEL
  const pointer =
    (await readJson<Pointer>(env, `pointers/${safe(channel)}/${runtime}/${platform}.json`)) ??
    (channel !== env.DEFAULT_CHANNEL
      ? await readJson<Pointer>(env, `pointers/${env.DEFAULT_CHANNEL}/${runtime}/${platform}.json`)
      : null)

  const wantsSig = h.has('expo-expect-signature')
  if (!pointer) return noUpdate(env, wantsSig)

  if (pointer.kind === 'update') {
    if (h.get('expo-current-update-id') === pointer.id) return noUpdate(env, wantsSig)
    return multipart('manifest', pointer, wantsSig)
  }

  // rollBackToEmbedded: no-op if the device is already running the embedded bundle.
  const embedded = h.get('expo-embedded-update-id')
  if (embedded && h.get('expo-current-update-id') === embedded) return noUpdate(env, wantsSig)
  return multipart('directive', pointer, wantsSig)
}

async function noUpdate(env: Env, wantsSig: boolean): Promise<Response> {
  const directive = await readJson<SignedPayload>(env, 'directives/noUpdateAvailable.json')
  if (!directive) return new Response(null, { status: 204, headers: protocolHeaders() })
  return multipart('directive', directive, wantsSig)
}

function multipart(name: 'manifest' | 'directive', payload: SignedPayload, wantsSig: boolean): Response {
  const boundary = `vatix-${crypto.randomUUID()}`
  const partHeaders = [
    `Content-Disposition: form-data; name="${name}"`,
    'Content-Type: application/json; charset=utf-8',
    ...(wantsSig ? [`expo-signature: ${payload.signature}`] : []),
  ]
  const body = `--${boundary}\r\n${partHeaders.join('\r\n')}\r\n\r\n${payload.body}\r\n--${boundary}--\r\n`
  return new Response(body, {
    headers: { ...protocolHeaders(), 'content-type': `multipart/mixed; boundary=${boundary}` },
  })
}

function protocolHeaders(): Record<string, string> {
  return { 'expo-protocol-version': '1', 'expo-sfv-version': '0', 'cache-control': 'private, max-age=0' }
}

async function asset(req: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'Expected GET' }, 405)
  const hash = url.pathname.slice('/assets/'.length)
  if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: 'Bad asset id' }, 400)

  // Assets are content-addressed and immutable, so the edge cache can keep them forever.
  const cache = caches.default
  const cacheKey = new Request(url.toString(), { method: 'GET' })
  const cached = await cache.match(cacheKey)
  if (cached) return req.method === 'HEAD' ? new Response(null, cached) : cached

  const obj = await env.OTA.get(`assets/${hash}`)
  if (!obj) return json({ error: 'Asset not found' }, 404)
  const headers = new Headers({
    'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    etag: obj.httpEtag,
  })
  const res = new Response(obj.body, { headers })
  ctx.waitUntil(cache.put(cacheKey, res.clone()))
  return req.method === 'HEAD' ? new Response(null, { headers }) : res
}

// Publish-script endpoints. Everything served to devices is signed, so this
// token can at worst break delivery — it cannot push unsigned code.
async function admin(req: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_TOKEN || !(await tokenMatches(req.headers.get('authorization'), env.ADMIN_TOKEN))) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const key = decodeURIComponent(url.pathname.slice('/_admin/object/'.length))
  if (!url.pathname.startsWith('/_admin/object/') || !/^(assets|pointers|history|directives)\/[\w.\-/]+$/.test(key) || key.includes('..')) {
    return json({ error: 'Bad key' }, 400)
  }

  if (req.method === 'HEAD') {
    const head = await env.OTA.head(key)
    return new Response(null, { status: head ? 200 : 404 })
  }
  if (req.method === 'GET') {
    const obj = await env.OTA.get(key)
    if (!obj) return json({ error: 'Not found' }, 404)
    return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' } })
  }
  if (req.method === 'PUT') {
    await env.OTA.put(key, req.body, {
      httpMetadata: { contentType: req.headers.get('content-type') ?? 'application/octet-stream' },
    })
    return json({ ok: true })
  }
  return json({ error: 'Method not allowed' }, 405)
}

async function tokenMatches(header: string | null, token: string): Promise<boolean> {
  if (!header?.startsWith('Bearer ')) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(header.slice(7))),
    crypto.subtle.digest('SHA-256', enc.encode(token)),
  ])
  return crypto.subtle.timingSafeEqual(a, b)
}

async function readJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.OTA.get(key)
  return obj ? ((await obj.json()) as T) : null
}

function safe(segment: string): string {
  return segment.replace(/[^\w.\-]/g, '_')
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}
