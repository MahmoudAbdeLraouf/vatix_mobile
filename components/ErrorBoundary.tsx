import React from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Share } from 'react-native'
import * as Sentry from '@sentry/react-native'

type Props = { children: React.ReactNode }
type State = { error: Error | null; info: string | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
    })
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.setState({ error, info: info.componentStack ?? null })
  }

  reset = () => this.setState({ error: null, info: null })

  share = async () => {
    const { error, info } = this.state
    if (!error) return
    const body = [
      'Vatix crash report',
      '',
      `Message: ${error.message}`,
      '',
      'Stack:',
      error.stack ?? '(no stack)',
      '',
      'Component stack:',
      info ?? '(no component stack)',
    ].join('\n')
    try {
      await Share.share({ message: body })
    } catch {}
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>App crashed</Text>
        <Text style={styles.subtitle}>Screenshot or share this to Claude.</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
          <Text style={styles.label}>Message</Text>
          <Text selectable style={styles.mono}>{error.message}</Text>
          <Text style={styles.label}>Stack</Text>
          <Text selectable style={styles.mono}>{error.stack ?? '(no stack)'}</Text>
          <Text style={styles.label}>Component stack</Text>
          <Text selectable style={styles.mono}>{info ?? '(no component stack)'}</Text>
        </ScrollView>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={this.share}>
            <Text style={styles.btnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={this.reset}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b1220', padding: 16, paddingTop: 60 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#94a3b8', marginTop: 4, marginBottom: 12 },
  scroll: { flex: 1, backgroundColor: '#111827', borderRadius: 8 },
  scrollBody: { padding: 12 },
  label: { color: '#f59e0b', marginTop: 12, marginBottom: 4, fontWeight: '700' },
  mono: { color: '#e5e7eb', fontFamily: 'Courier', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, backgroundColor: '#F5B800', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnAlt: { backgroundColor: '#334155' },
  btnText: { color: '#0b1220', fontWeight: '800' },
})
