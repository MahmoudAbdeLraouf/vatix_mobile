import { Text, TextInput } from 'react-native'

// Applies direction-aware defaults to every bare Text / TextInput (i.e. one
// rendered without its own `style` prop). Components that pass a style prop
// override defaultProps entirely — that's a React Native limitation of
// defaultProps, not a bug — so per-screen text still needs to opt into a
// direction-aware style when it renders translatable content.
//
// We do NOT read I18nManager.isRTL here. In Expo Go the native flag never
// flips regardless of what forceRTL does, so the caller passes the desired
// direction explicitly (derived from the stored locale).
export function applyTextDirectionDefaults(isRtl: boolean): void {
  const baseStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: isRtl ? ('right' as const) : ('left' as const),
  }

  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> }
  TextAny.defaultProps = { ...(TextAny.defaultProps ?? {}), style: baseStyle }

  const InputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> }
  InputAny.defaultProps = { ...(InputAny.defaultProps ?? {}), style: baseStyle }
}
