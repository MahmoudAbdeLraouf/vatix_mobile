const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://vatix.store'

export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\s+/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('0')) digits = '20' + digits.slice(1)
  return digits.replace(/\D/g, '') || null
}

// wa.me deep link with a prefilled "interested in" message pointing at the listing.
export function buildWaLink(
  whatsapp: string | null | undefined,
  title: string,
  price: number,
  productIdent: number | string,
  ar: boolean,
): string | null {
  const n = normalizeWhatsapp(whatsapp)
  if (!n) return null
  const url = `${SITE_URL}/products/${productIdent}`
  const msg = ar
    ? `مرحباً، أنا مهتم بالمنتج:\n${title}\nالسعر: ${price} جنيه\n${url}`
    : `Hi, I'm interested in:\n${title}\nPrice: ${price} EGP\n${url}`
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`
}
