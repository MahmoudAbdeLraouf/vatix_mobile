import { Alert } from 'react-native'
import * as Sentry from '@sentry/react-native'

type ErrorUtilsShape = {
  getGlobalHandler?: () => (error: any, isFatal?: boolean) => void
  setGlobalHandler?: (fn: (error: any, isFatal?: boolean) => void) => void
}

let installed = false

export function installGlobalErrorHandler() {
  if (installed) return
  installed = true

  const EU: ErrorUtilsShape | undefined = (global as any).ErrorUtils
  const prev = EU?.getGlobalHandler?.()

  EU?.setGlobalHandler?.((error, isFatal) => {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[GlobalError]', isFatal ? 'FATAL' : 'non-fatal', err.message, err.stack)
    Sentry.captureException(err, { level: isFatal ? 'fatal' : 'error' })
    if (__DEV__) {
      Alert.alert(
        isFatal ? 'Fatal error' : 'Error',
        `${err.message}\n\n${(err.stack ?? '').slice(0, 1200)}`,
        [{ text: 'OK' }],
        { cancelable: true },
      )
    }
    prev?.(error, isFatal)
  })

  const origUnhandled = (global as any).Promise?.prototype?.catch
  if (typeof origUnhandled === 'function' && !(global as any).__vatixPromiseTraced) {
    ;(global as any).__vatixPromiseTraced = true
    const tracker: any = require('promise/setimmediate/rejection-tracking')
    tracker?.enable?.({
      allRejections: true,
      onUnhandled: (id: number, error: any) => {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error('[UnhandledPromise]', id, err.message, err.stack)
        Sentry.captureException(err)
      },
      onHandled: () => {},
    })
  }
}
