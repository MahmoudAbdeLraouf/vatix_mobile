import { useEffect, useMemo, useState } from 'react'
import { getBrands, getCategories, localeName, type Brand, type Category } from '@/lib/api'
import { useLocale } from '@/contexts/locale'
import type { SelectOption } from '@/components/ui/SearchableSelect'

/** Active categories/brands as `SearchableSelect` options, mapped like add.tsx. */
export function useImportOptions() {
  const { locale } = useLocale()
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  useEffect(() => {
    let alive = true
    Promise.all([getCategories(), getBrands()])
      .then(([cats, brs]) => {
        if (!alive) return
        setCategories(cats)
        setBrands(brs)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      categories
        .filter((c) => c.isActive)
        .map((c) => ({ value: String(c.id), label: localeName(c.translations, locale) })),
    [categories, locale],
  )
  const brandOptions = useMemo<SelectOption[]>(
    () =>
      brands
        .filter((b) => b.isActive)
        .map((b) => ({ value: String(b.id), label: localeName(b.translations, locale) })),
    [brands, locale],
  )

  return { categoryOptions, brandOptions }
}
