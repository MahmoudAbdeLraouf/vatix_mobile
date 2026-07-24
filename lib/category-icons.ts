import React from 'react'
import { Ionicons } from '@expo/vector-icons'

export type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// Maps a localized category name (ar or en) → Ionicon glyph.
// Used by the home category rail and the ProductCard image placeholder so both
// surfaces stay in lockstep when a new electronics category is added.
export function getCategoryIcon(name: string | null | undefined): IoniconName {
  const n = (name ?? '').toLowerCase()
  if (n.includes('موبايل') || n.includes('هاتف') || n.includes('mobile') || n.includes('phone')) return 'phone-portrait-outline'
  if (n.includes('لابتوب') || n.includes('laptop')) return 'laptop-outline'
  if (n.includes('تابلت') || n.includes('tablet')) return 'tablet-portrait-outline'
  if (n.includes('كاميرا') || n.includes('camera')) return 'camera-outline'
  if (n.includes('شاشة') || n.includes('تلفزيون') || n.includes('tv') || n.includes('monitor')) return 'tv-outline'
  if (n.includes('صوت') || n.includes('سماعة') || n.includes('audio') || n.includes('headphone') || n.includes('speaker')) return 'headset-outline'
  if (n.includes('طابعة') || n.includes('print')) return 'print-outline'
  if (n.includes('كمبيوتر') || n.includes('computer') || n.includes('desktop')) return 'desktop-outline'
  if (n.includes('ألعاب') || n.includes('game') || n.includes('gaming')) return 'game-controller-outline'
  if (n.includes('ملحقات') || n.includes('accessories')) return 'hardware-chip-outline'
  if (n.includes('ذكي') || n.includes('smart')) return 'home-outline'
  return 'pricetag-outline'
}
