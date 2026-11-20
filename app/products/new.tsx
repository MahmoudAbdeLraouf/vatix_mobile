import { Redirect } from 'expo-router'

// The old "where are your products?" chooser. Add Product now goes straight to
// the manual form and bulk import lives on My Ads; kept as a redirect so older
// OTA bundles' links and deep links still land somewhere sensible.
export default function NewProductRedirect() {
  return <Redirect href="/products/add" />
}
