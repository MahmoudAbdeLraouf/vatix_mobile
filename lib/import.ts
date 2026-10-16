import { authRawRequest, authUploadForm } from '@/lib/auth'

// Product import (Excel/CSV, Shopify, EasyOrders). Types, API wrappers and the
// pure CSV helpers mirror vatix_website/app/dashboard/products/import/page.tsx.

const IMPORT = '/store/products/import'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CsvRow {
  title: string
  description: string | null
  price: number
  categoryId: number | null
  brandId: number | null
  images: string[]
  rowNumber: number
}

/** Shared error shape used by every flow's error list. */
export interface ImportPreviewError {
  rowNumber: number
  field: string
  message: string
}

export interface CsvPreviewResult {
  valid: CsvRow[]
  errors: ImportPreviewError[]
}

export interface ShopifyRow {
  shopifyId: string
  title: string
  description: string | null
  price: number
  imageUrls: string[]
  status: string
  rowNumber: number
  categoryId: number | null
  brandId: number | null
}

export interface ShopifyPreviewResult {
  valid: ShopifyRow[]
  errors: ImportPreviewError[]
  nextPageInfo: string | null
  skippedExisting?: number
  shop: string
}

export interface EasyOrdersRow {
  easyOrdersProductId: string
  title: string
  description: string | null
  price: number
  imageUrls: string[]
  rowNumber: number
  categoryId: number | null
  brandId: number | null
}

export interface EasyOrdersPreviewError {
  rowNumber: number
  easyOrdersProductId: string | null
  errors: string[]
}

export interface EasyOrdersPreviewResult {
  valid: EasyOrdersRow[]
  errors: EasyOrdersPreviewError[]
  hasMore: boolean
  page: number
  pageCount: number
  skippedExisting?: number
}

export interface ShopifyStatus {
  connected: boolean
  shop?: string
}

export interface EasyOrdersStatus {
  connected: boolean
  connectedAt?: string
}

export interface ImportConfirmResult {
  createdIds: number[]
  skippedExisting?: number
}

/** Shopify and EasyOrders accept at most this many image URLs per row. */
export const MAX_IMPORT_IMAGES = 5

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Non-2xx import response, keeping the status and the backend's error code. */
export class ImportApiError extends Error {
  status: number
  code: string | null
  retryAfter: number | null
  rowNumber: number | null
  /** Effective listing cap on CLIENT_PRODUCT_CAP_REACHED. */
  cap: number | null

  constructor(status: number, body: any) {
    super(importErrorMessage(body))
    this.name = 'ImportApiError'
    this.status = status
    this.code = importErrorCode(body)
    const nested = body && typeof body.message === 'object' ? body.message : null
    const retry = body?.retryAfter ?? nested?.retryAfter
    this.retryAfter = typeof retry === 'number' ? retry : null
    const row = body?.rowNumber ?? nested?.rowNumber
    this.rowNumber = typeof row === 'number' ? row : null
    const cap = body?.cap ?? nested?.cap
    this.cap = typeof cap === 'number' ? cap : null
  }
}

/** Shopify errors sometimes nest the code under `message`, so read both shapes. */
export function importErrorCode(body: any): string | null {
  if (typeof body?.code === 'string') return body.code
  if (typeof body?.message?.code === 'string') return body.message.code
  return null
}

function importErrorMessage(body: any): string {
  const msg = body?.message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg?.message === 'string') return msg.message
  return ''
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { status, body } = await authRawRequest(`${IMPORT}${path}`, init)
  if (status < 200 || status >= 300) throw new ImportApiError(status, body)
  return body as T
}

function postJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ─── Excel / CSV ─────────────────────────────────────────────────────────────

/** Uploads a normalized CSV file (title,description,price,images) for validation. */
export async function previewCsv(uri: string, name = 'import.csv'): Promise<CsvPreviewResult> {
  const formData = new FormData()
  formData.append('file', { uri, type: 'text/csv', name } as unknown as Blob)
  const { status, body } = await authUploadForm(`${IMPORT}/preview`, formData)
  if (status < 200 || status >= 300) throw new ImportApiError(status, body)
  return body as CsvPreviewResult
}

export function confirmCsv(rows: {
  title: string
  description: string | null
  price: number
  categoryId: number
  brandId?: number
  images?: string[]
  rowNumber: number
}[]): Promise<ImportConfirmResult> {
  return postJson('/confirm', { rows })
}

// ─── EasyOrders ──────────────────────────────────────────────────────────────

export function getEasyOrdersStatus(): Promise<EasyOrdersStatus> {
  return request('/easy-orders/status')
}

export function connectEasyOrders(apiKey: string): Promise<unknown> {
  return postJson('/easy-orders/connection', { apiKey })
}

export function disconnectEasyOrders(): Promise<unknown> {
  return request('/easy-orders/connection', { method: 'DELETE' })
}

export function getEasyOrdersPreview(page: number, limit = 25): Promise<EasyOrdersPreviewResult> {
  return request(`/easy-orders/preview?limit=${limit}&page=${page}`)
}

export function confirmEasyOrders(rows: {
  easyOrdersProductId: string
  rowNumber: number
  title: string
  description: string | null
  price: number
  imageUrls: string[]
  categoryId: number
  brandId: number
}[]): Promise<ImportConfirmResult> {
  return postJson('/easy-orders/confirm', { rows })
}

/** EasyOrders reports one entry per product with a list of messages; flatten to the shared shape. */
export function flattenEasyOrdersErrors(errors: EasyOrdersPreviewError[]): ImportPreviewError[] {
  return errors.flatMap((e) =>
    e.errors.map((message) => ({
      rowNumber: e.rowNumber,
      field: e.easyOrdersProductId ?? '',
      message,
    })),
  )
}

// ─── Shopify ─────────────────────────────────────────────────────────────────

export function getShopifyStatus(): Promise<ShopifyStatus> {
  return request('/shopify/status')
}

export function getShopifyInstallUrl(shop: string): Promise<{ installUrl: string }> {
  return request(`/shopify/install?shop=${encodeURIComponent(shop)}`)
}

export function getShopifyPreview(limit = 50): Promise<ShopifyPreviewResult> {
  return request(`/shopify/preview?limit=${limit}`)
}

export function confirmShopify(rows: {
  shopifyId: string
  rowNumber: number
  title: string
  description: string | null
  price: number
  imageUrls: string[]
  categoryId: number
  brandId: number
}[]): Promise<ImportConfirmResult> {
  return postJson('/shopify/confirm', { rows })
}

export function disconnectShopify(): Promise<unknown> {
  return request('/shopify/connection', { method: 'DELETE' })
}

export function normalizeShopDomain(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!trimmed) return ''
  return trimmed.endsWith('.myshopify.com') ? trimmed : `${trimmed}.myshopify.com`
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

export type InternalField = 'title' | 'description' | 'price' | 'images'

export const INTERNAL_FIELDS: InternalField[] = ['title', 'description', 'price', 'images']

export const EMPTY_MAPPING: Record<InternalField, string | null> = {
  title: null,
  description: null,
  price: null,
  images: null,
}

export function parseCsvHeaderLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current)
      current = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(current)
      rows.push(row)
      current = ''
      row = []
    } else {
      current += ch
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0))
}

export function csvCellEscape(cell: string): string {
  if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

export function splitImageCell(cell: string): string[] {
  if (!cell) return []
  return cell
    .split('|')
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
}

/**
 * Rewrites the source CSV into the backend's `title,description,price,images`
 * layout. Rows with an empty title are treated as extra images for the
 * product above them (Shopify-style exports).
 */
export function buildNormalizedCsv(
  sourceText: string,
  mapping: Record<InternalField, string | null>,
): string {
  const rows = parseCsvRows(sourceText)
  if (rows.length === 0) return ''
  const sourceHeaders = rows[0].map((h) => h.trim())
  const indexFor: Record<InternalField, number> = {
    title: mapping.title ? sourceHeaders.indexOf(mapping.title) : -1,
    description: mapping.description ? sourceHeaders.indexOf(mapping.description) : -1,
    price: mapping.price ? sourceHeaders.indexOf(mapping.price) : -1,
    images: mapping.images ? sourceHeaders.indexOf(mapping.images) : -1,
  }

  const cellAt = (src: string[], idx: number): string => {
    if (idx < 0 || idx >= src.length) return ''
    return src[idx] ?? ''
  }

  type Current = {
    title: string
    description: string
    price: string
    images: string[]
  }
  const products: Current[] = []
  let current: Current | null = null

  for (let r = 1; r < rows.length; r++) {
    const src = rows[r]
    const title = cellAt(src, indexFor.title).trim()
    const rowImages = splitImageCell(cellAt(src, indexFor.images))

    if (title.length > 0) {
      if (current) products.push(current)
      current = {
        title: cellAt(src, indexFor.title),
        description: cellAt(src, indexFor.description),
        price: cellAt(src, indexFor.price),
        images: [...rowImages],
      }
    } else if (current) {
      for (const url of rowImages) {
        if (!current.images.includes(url)) current.images.push(url)
      }
    }
  }
  if (current) products.push(current)

  const lines: string[] = [INTERNAL_FIELDS.join(',')]
  for (const p of products) {
    lines.push(
      [
        csvCellEscape(p.title),
        csvCellEscape(p.description),
        csvCellEscape(p.price),
        csvCellEscape(p.images.join('|')),
      ].join(','),
    )
  }
  return lines.join('\n')
}

export function autoMapHeaders(headers: string[]): Record<InternalField, string | null> {
  const next: Record<InternalField, string | null> = { ...EMPTY_MAPPING }
  for (const field of INTERNAL_FIELDS) {
    const match = headers.find((h) => h.toLowerCase() === field)
    if (match) next[field] = match
  }
  return next
}
