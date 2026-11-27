/** Same rules as the backend (product-models/arabic-aliases.ts) so client filtering matches server search */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every query word must appear somewhere in the name or its aliases */
export function matchesSearch(query: string, name: string, aliases?: string[] | null): boolean {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean)
  if (!tokens.length) return true
  const haystack = normalizeSearch([name, ...(aliases ?? [])].join(' '))
  return tokens.every(t => haystack.includes(t))
}
