export const BRAND_SLUG_MAP: Record<string, string> = {
  // English
  'Apple': 'apple', 'Samsung': 'samsung', 'Sony': 'sony',
  'LG': 'lg', 'Huawei': 'huawei', 'Xiaomi': 'xiaomi',
  'Lenovo': 'lenovo', 'Dell': 'dell', 'HP': 'hp',
  'Asus': 'asus', 'ASUS': 'asus', 'Acer': 'acer',
  'Nikon': 'nikon', 'JBL': 'jbl', 'Bose': 'bose',
  'OPPO': 'oppo', 'Oppo': 'oppo', 'OnePlus': 'oneplus',
  'Vivo': 'vivo', 'Panasonic': 'panasonic', 'Realme': 'realme',
  'Motorola': 'motorola', 'Nokia': 'nokia', 'Google': 'google',
  'Intel': 'intel', 'AMD': 'amd', 'Nvidia': 'nvidia', 'NVIDIA': 'nvidia',
  'Corsair': 'corsair', 'Razer': 'razer', 'Logitech': 'logitech',
  'SanDisk': 'sandisk', 'Western Digital': 'westerndigital', 'WD': 'westerndigital',
  'Seagate': 'seagate', 'Kingston': 'kingston',
  // Arabic
  'آبل': 'apple', 'سامسونج': 'samsung', 'سوني': 'sony',
  'إل جي': 'lg', 'هواوي': 'huawei', 'شاومي': 'xiaomi',
  'لينوفو': 'lenovo', 'ديل': 'dell', 'أسوس': 'asus',
  'أيسر': 'acer', 'نيكون': 'nikon', 'بانسونيك': 'panasonic',
  'موتورولا': 'motorola', 'نوكيا': 'nokia', 'جوجل': 'google',
  'إنتل': 'intel', 'رايزر': 'razer',
}

export interface BrandIconData {
  xml: string
  hex: string
  hasSvg: true
}

export interface BrandFallback {
  hasSvg: false
}

export type BrandIcon = BrandIconData | BrandFallback

export function getBrandIcon(name: string): BrandIcon {
  const slug = BRAND_SLUG_MAP[name] ?? BRAND_SLUG_MAP[name.trim()]
  if (!slug) return { hasSvg: false }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const si = require('simple-icons')
    const key = 'si' + slug.charAt(0).toUpperCase() + slug.slice(1)
    const icon = si[key]
    if (!icon) return { hasSvg: false }
    return {
      xml: icon.svg.replace('<svg ', `<svg fill="#${icon.hex}" `),
      hex: icon.hex,
      hasSvg: true,
    }
  } catch {
    return { hasSvg: false }
  }
}
