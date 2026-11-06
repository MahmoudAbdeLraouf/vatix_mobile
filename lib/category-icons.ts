import React from 'react'
import { Ionicons } from '@expo/vector-icons'

export type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type CategoryLike = { translations?: { name: string }[] | null } | string | null | undefined

const PHONE_WORDS = ['موبايل', 'هاتف', 'هواتف', 'phone', 'mobile']
/** A phone word followed by "and": "هواتف و…", "Phones & …", "Mobiles and …". */
const PHONE_FIRST = /^\s*(موبايلات|موبايل|هواتف|هاتف|phones?|mobiles?)\s+(&|and\s|و)/

// Same rules as the website's lib/category-icon.tsx — keep the two in sync.
// Checked in order, first hit wins. Accessories and watches go before phones so
// "إكسسوارات موبايلات" and "ساعات ذكية" don't read as phones / smart home, and audio goes
// before phones because "headphones" contains "phone".
const RULES: [IoniconName, string[]][] = [
  ['battery-charging-outline', ['اكسسوار', 'ملحقات', 'accessor', 'شاحن', 'شواحن', 'charger']],
  ['watch-outline', ['ساعه', 'ساعات', 'watch']],
  ['tablet-portrait-outline', ['تابلت', 'لوحي', 'لوحيه', 'tablet', 'ipad']],
  ['headset-outline', ['سماع', 'صوتي', 'audio', 'headphone', 'earbud', 'speaker']],
  ['phone-portrait-outline', PHONE_WORDS],
  ['laptop-outline', ['لابتوب', 'حاسوب', 'حواسيب', 'كمبيوتر', 'laptop', 'computer']],
  ['tv-outline', ['شاش', 'تلفزيون', 'تليفزيون', 'tvs', 'tv ', 'screen', 'monitor', 'television']],
  ['game-controller-outline', ['العاب', 'كونسول', 'gaming', 'console', 'game']],
  ['camera-outline', ['كامير', 'تصوير', 'camera', 'photo']],
  ['print-outline', ['طابع', 'سكانر', 'printer', 'scanner']],
  ['wifi-outline', ['شبك', 'راوتر', 'انترنت', 'network', 'router', 'wifi']],
  ['home-outline', ['منزل', 'smart home', 'home']],
]

const FALLBACK: IoniconName = 'cube-outline'

/** Lowercase, unify alef/ta-marbuta forms and strip tashkeel so keyword checks stay simple. */
function normalize(name: string): string {
  return ` ${name.toLowerCase()} `
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْـ]/g, '')
}

function iconOfName(name: string): IoniconName | null {
  const n = normalize(name)
  // "هواتف وإكسسوارات" / "Phones & Accessories" are phone categories, not accessories
  // (but "mobile accessories" is accessories).
  if (PHONE_FIRST.test(n)) return 'phone-portrait-outline'
  return RULES.find(([, words]) => words.some(w => n.includes(w)))?.[0] ?? null
}

// Maps a category (every translation is tried) or a single name → Ionicon glyph.
// Used by the home category rail and the ProductCard image placeholder so both
// surfaces stay in lockstep when a new electronics category is added.
export function getCategoryIcon(cat: CategoryLike): IoniconName {
  if (!cat) return FALLBACK
  const names = typeof cat === 'string' ? [cat] : (cat.translations ?? []).map(t => t.name)
  for (const name of names) {
    if (!name) continue
    const icon = iconOfName(name)
    if (icon) return icon
  }
  return FALLBACK
}
