import { Redirect } from 'expo-router'

// Stub screen — the tab button intercepts presses and routes to /products/add,
// so this is only reached if someone navigates here directly.
export default function AddTabStub() {
  return <Redirect href="/products/add" />
}
