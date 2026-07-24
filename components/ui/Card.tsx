import React from 'react'
import { StyleSheet, Text, View, ViewProps, ViewStyle, TextStyle } from 'react-native'
import { colors, fonts, radius, shadow } from '@/constants/theme'

// Mirrors website .card / .card-hd / .card-bd (vatix_website/app/globals.css).

interface CardProps extends ViewProps {
  style?: ViewStyle
  children?: React.ReactNode
}

export function Card({ style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  )
}

interface CardHeaderProps extends ViewProps {
  title?: string
  right?: React.ReactNode
  titleStyle?: TextStyle
  style?: ViewStyle
  children?: React.ReactNode
}

export function CardHeader({ title, right, titleStyle, style, children, ...rest }: CardHeaderProps) {
  return (
    <View style={[styles.header, style]} {...rest}>
      <View style={styles.headerTitleWrap}>
        {title ? <Text style={[styles.headerTitle, titleStyle]}>{title}</Text> : null}
        {children}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  )
}

interface CardBodyProps extends ViewProps {
  style?: ViewStyle
  children?: React.ReactNode
}

export function CardBody({ style, children, ...rest }: CardBodyProps) {
  return (
    <View style={[styles.body, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  // .card { background: white; border-radius: var(--r); border: 1.5px solid var(--g200); box-shadow: var(--ss) }
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    ...shadow.ss,
    overflow: 'hidden',
  },
  // .card-hd { padding: 15px 20px; border-bottom: 1px solid var(--g200) }
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.g200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // .card-hd h3 { font-size: 15px; font-weight: 800; color: var(--dk) }
  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.dk,
  },
  headerRight: {
    marginStart: 12,
  },
  // .card-bd { padding: 20px }
  body: {
    padding: 20,
  },
})
